import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { WebSale } from '../database/entities/webSale.entity';
import { WebSaleInvoice } from '../database/entities/webSaleInvoices';

@Injectable()
export class EfactService {
    constructor(
        private readonly configService: ConfigService,

        @InjectRepository(WebSale)
        private readonly saleRepository: Repository<WebSale>,

        @InjectRepository(WebSaleInvoice)
        private readonly invoiceRepository: Repository<WebSaleInvoice>,
    ) { }

    private toMoney(value: number) {
        return Number(value.toFixed(2));
    }

    private padCorrelative(value: number) {
        return String(value).padStart(8, '0');
    }

    private async getNextCorrelative(serie: string) {
        const lastInvoice = await this.invoiceRepository.findOne({
            where: { serie },
            order: { correlative: 'DESC' },
        });

        return lastInvoice ? lastInvoice.correlative + 1 : 1;
    }

    private async getAccessToken(): Promise<string> {
        const tokenUrl = this.configService.get<string>('EFACT_TOKEN_URL');
        const username = this.configService.get<string>('EFACT_USER');
        const password = this.configService.get<string>('EFACT_PASSWORD');

        const clientId = this.configService.get<string>('EFACT_CLIENT_ID') || 'client';
        const clientSecret = this.configService.get<string>('EFACT_CLIENT_SECRET') || 'secret';

        if (!tokenUrl || !username || !password) {
            throw new InternalServerErrorException(
                'Faltan credenciales de eFact en el archivo .env'
            );
        }

        try {
            const body = new URLSearchParams();
            body.append('grant_type', 'password');
            body.append('username', username);
            body.append('password', password);

            const basicToken = Buffer
                .from(`${clientId}:${clientSecret}`)
                .toString('base64');

            const response = await axios.post(tokenUrl, body.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${basicToken}`,
                },
            });

            const accessToken = response.data?.access_token;

            if (!accessToken) {
                console.error('Respuesta token eFact:', response.data);
                throw new Error('eFact no devolvió access_token');
            }

            return accessToken;
        } catch (error: any) {
            console.error(
                'Error token eFact:',
                error.response?.data || error.message
            );

            throw new InternalServerErrorException(
                'No se pudo obtener el token de eFact'
            );
        }
    }

    async generateBoletaFromWebSale(saleId: number) {
        const existingInvoice = await this.invoiceRepository.findOne({
            where: { sale_id: saleId },
        });

        if (existingInvoice) {
            return {
                message: 'La boleta ya fue generada anteriormente',
                invoice: existingInvoice,
            };
        }

        const sale = await this.saleRepository.findOne({
            where: { id: saleId },
            relations: [
                'details',
                'details.product',
                'details.productSize',
                'user',
            ],
        });

        if (!sale) {
            throw new NotFoundException('Venta web no encontrada');
        }

        if (sale.status !== 'ENTREGADO') {
            throw new BadRequestException(
                'Solo se puede generar boleta cuando el pedido esté ENTREGADO'
            );
        }

        if (!sale.details?.length) {
            throw new BadRequestException('La venta no tiene productos');
        }

        const validDetails = sale.details.filter(
            (d: any) => d.detail_status === 'VENDIDO'
        );

        if (!validDetails.length) {
            throw new BadRequestException(
                'No hay productos vendidos para emitir la boleta'
            );
        }

        const serie = this.configService.get<string>('EFACT_SERIE_BOLETA') || 'B001';
        const correlative = await this.getNextCorrelative(serie);
        const correlativeText = this.padCorrelative(correlative);
        const documentNumber = `${serie}-${correlativeText}`;

        const rucEmisor = this.configService.get<string>('EFACT_RUC_EMISOR');

        const fileName = `${rucEmisor}-03-${documentNumber}.json`;

        const payload = this.buildBoletaJson(
            sale,
            validDetails,
            documentNumber
        );

        const accessToken = await this.getAccessToken();

        try {
            const documentUrl = this.configService.get<string>('EFACT_DOCUMENT_URL');

            const response = await axios.post(documentUrl!, payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            const efactTicket =
                response.data?.ticket ||
                response.data?.Ticket ||
                response.data?.numTicket ||
                response.data?.numeroTicket;

            const invoice = this.invoiceRepository.create({
                sale_id: sale.id,
                document_type: '03',
                serie,
                correlative,
                document_number: documentNumber,
                file_name: fileName,
                efact_ticket: efactTicket,
                status: efactTicket ? 'TICKET_GENERADO' : 'ENVIADO',
                request_payload: payload,
                efact_response: response.data,
            });

            await this.invoiceRepository.save(invoice);

            return {
                message: 'Boleta enviada correctamente a eFact',
                invoice,
                efact_response: response.data,
            };
        } catch (error: any) {
            console.error('Error enviando boleta eFact:', error.response?.data || error.message);

            throw new InternalServerErrorException({
                message: 'No se pudo enviar la boleta a eFact',
                error: error.response?.data || error.message,
            });
        }
    }

    private buildBoletaJson(
        sale: WebSale,
        details: any[],
        documentNumber: string,
    ) {
        const rucEmisor = this.configService.get<string>('EFACT_RUC_EMISOR');
        const razonSocial = this.configService.get<string>('EFACT_RAZON_SOCIAL');
        const nombreComercial = this.configService.get<string>('EFACT_NOMBRE_COMERCIAL');
        const ubigeo = this.configService.get<string>('EFACT_UBIGEO');
        const direccion = this.configService.get<string>('EFACT_DIRECCION');
        const departamento = this.configService.get<string>('EFACT_DEPARTAMENTO');
        const provincia = this.configService.get<string>('EFACT_PROVINCIA');
        const distrito = this.configService.get<string>('EFACT_DISTRITO');

        const total = this.toMoney(
            details.reduce((sum, d) => {
                const amount =
                    d.final_amount !== null && d.final_amount !== undefined
                        ? Number(d.final_amount)
                        : Number(d.subtotal);

                return sum + amount;
            }, 0)
        );

        const baseGravada = this.toMoney(total / 1.18);
        const igv = this.toMoney(total - baseGravada);

        const issueDate = new Date().toISOString().slice(0, 10);

        return {
            _D: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
            _A: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            _B: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
            _E: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',

            Invoice: [
                {
                    UBLVersionID: [{ _: '2.1' }],
                    CustomizationID: [{ _: '2.0' }],

                    ID: [{ _: documentNumber }],

                    IssueDate: [{ _: issueDate }],

                    InvoiceTypeCode: [
                        {
                            _: '03',
                            listID: '0101',
                            listAgencyName: 'PE:SUNAT',
                            listName: 'Tipo de Documento',
                            name: 'Tipo de Operacion',
                            listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01',
                            listSchemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51',
                        },
                    ],

                    DocumentCurrencyCode: [
                        {
                            _: 'PEN',
                            listID: 'ISO 4217 Alpha',
                            listName: 'Currency',
                            listAgencyName: 'United Nations Economic Commission for Europe',
                        },
                    ],

                    LineCountNumeric: [
                        {
                            _: String(details.length),
                        },
                    ],

                    Signature: [
                        {
                            ID: [{ _: 'IDSignature' }],
                            SignatoryParty: [
                                {
                                    PartyIdentification: [
                                        {
                                            ID: [{ _: rucEmisor }],
                                        },
                                    ],
                                    PartyName: [
                                        {
                                            Name: [{ _: razonSocial }],
                                        },
                                    ],
                                },
                            ],
                            DigitalSignatureAttachment: [
                                {
                                    ExternalReference: [
                                        {
                                            URI: [{ _: 'IDSignature' }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],

                    AccountingSupplierParty: [
                        {
                            Party: [
                                {
                                    PartyIdentification: [
                                        {
                                            ID: [
                                                {
                                                    _: rucEmisor,
                                                    schemeID: '6',
                                                    schemeName: 'Documento de Identidad',
                                                    schemeAgencyName: 'PE:SUNAT',
                                                    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
                                                },
                                            ],
                                        },
                                    ],

                                    PartyName: [
                                        {
                                            Name: [{ _: nombreComercial || razonSocial }],
                                        },
                                    ],

                                    PartyLegalEntity: [
                                        {
                                            RegistrationName: [{ _: razonSocial }],
                                            RegistrationAddress: [
                                                {
                                                    ID: [
                                                        {
                                                            _: ubigeo,
                                                            schemeAgencyName: 'PE:INEI',
                                                            schemeName: 'Ubigeos',
                                                        },
                                                    ],
                                                    AddressLine: [
                                                        {
                                                            Line: [{ _: direccion }],
                                                        },
                                                    ],
                                                    CitySubdivisionName: [{ _: '-' }],
                                                    CityName: [{ _: provincia }],
                                                    CountrySubentity: [{ _: departamento }],
                                                    District: [{ _: distrito }],
                                                    Country: [
                                                        {
                                                            IdentificationCode: [
                                                                {
                                                                    _: 'PE',
                                                                    listID: 'ISO 3166-1',
                                                                    listAgencyName: 'United Nations Economic Commission for Europe',
                                                                    listName: 'Country',
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                    AddressTypeCode: [
                                                        {
                                                            _: '0000',
                                                            listAgencyName: 'PE:SUNAT',
                                                            listName: 'Establecimientos anexos',
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],

                    AccountingCustomerParty: [
                        {
                            Party: [
                                {
                                    PartyIdentification: [
                                        {
                                            ID: [
                                                {
                                                    _: sale.customer_dni,
                                                    schemeID: this.getCustomerDocumentType(sale.customer_dni),
                                                    schemeName: 'Documento de Identidad',
                                                    schemeAgencyName: 'PE:SUNAT',
                                                    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
                                                },
                                            ],
                                        },
                                    ],

                                    PartyLegalEntity: [
                                        {
                                            RegistrationName: [
                                                {
                                                    _: sale.customer_name,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],

                    TaxTotal: [
                        {
                            TaxAmount: [
                                {
                                    _: igv,
                                    currencyID: 'PEN',
                                },
                            ],
                            TaxSubtotal: [
                                {
                                    TaxableAmount: [
                                        {
                                            _: baseGravada,
                                            currencyID: 'PEN',
                                        },
                                    ],
                                    TaxAmount: [
                                        {
                                            _: igv,
                                            currencyID: 'PEN',
                                        },
                                    ],
                                    TaxCategory: [
                                        {
                                            TaxScheme: [
                                                {
                                                    ID: [
                                                        {
                                                            _: '1000',
                                                            schemeName: 'Codigo de tributos',
                                                            schemeAgencyName: 'PE:SUNAT',
                                                            schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05',
                                                        },
                                                    ],
                                                    Name: [{ _: 'IGV' }],
                                                    TaxTypeCode: [{ _: 'VAT' }],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],

                    LegalMonetaryTotal: [
                        {
                            LineExtensionAmount: [
                                {
                                    _: baseGravada,
                                    currencyID: 'PEN',
                                },
                            ],
                            TaxInclusiveAmount: [
                                {
                                    _: total,
                                    currencyID: 'PEN',
                                },
                            ],
                            PayableAmount: [
                                {
                                    _: total,
                                    currencyID: 'PEN',
                                },
                            ],
                        },
                    ],

                    InvoiceLine: details.map((detail, index) => {
                        const quantity = Number(detail.quantity);
                        const unitPriceWithIgv = Number(detail.sale_price);
                        const subtotalWithIgv = this.toMoney(quantity * unitPriceWithIgv);

                        const itemBase = this.toMoney(subtotalWithIgv / 1.18);
                        const itemIgv = this.toMoney(subtotalWithIgv - itemBase);
                        const unitPriceWithoutIgv = this.toMoney(unitPriceWithIgv / 1.18);

                        const description =
                            detail.product?.article_description ||
                            detail.product_name ||
                            `Producto ${detail.product_id}`;

                        const articleCode =
                            detail.product?.article_code ||
                            String(detail.product_id);

                        return {
                            ID: [{ _: String(index + 1) }],

                            InvoicedQuantity: [
                                {
                                    _: quantity,
                                    unitCode: 'NIU',
                                    unitCodeListID: 'UN/ECE rec 20',
                                    unitCodeListAgencyName: 'United Nations Economic Commission for Europe',
                                },
                            ],

                            LineExtensionAmount: [
                                {
                                    _: itemBase,
                                    currencyID: 'PEN',
                                },
                            ],

                            PricingReference: [
                                {
                                    AlternativeConditionPrice: [
                                        {
                                            PriceAmount: [
                                                {
                                                    _: unitPriceWithIgv,
                                                    currencyID: 'PEN',
                                                },
                                            ],
                                            PriceTypeCode: [
                                                {
                                                    _: '01',
                                                    listName: 'Tipo de Precio',
                                                    listAgencyName: 'PE:SUNAT',
                                                    listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16',
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],

                            TaxTotal: [
                                {
                                    TaxAmount: [
                                        {
                                            _: itemIgv,
                                            currencyID: 'PEN',
                                        },
                                    ],
                                    TaxSubtotal: [
                                        {
                                            TaxableAmount: [
                                                {
                                                    _: itemBase,
                                                    currencyID: 'PEN',
                                                },
                                            ],
                                            TaxAmount: [
                                                {
                                                    _: itemIgv,
                                                    currencyID: 'PEN',
                                                },
                                            ],
                                            TaxCategory: [
                                                {
                                                    Percent: [{ _: 18 }],
                                                    TaxExemptionReasonCode: [
                                                        {
                                                            _: '10',
                                                            listAgencyName: 'PE:SUNAT',
                                                            listName: 'Afectacion del IGV',
                                                            listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07',
                                                        },
                                                    ],
                                                    TaxScheme: [
                                                        {
                                                            ID: [
                                                                {
                                                                    _: '1000',
                                                                    schemeName: 'Codigo de tributos',
                                                                    schemeAgencyName: 'PE:SUNAT',
                                                                    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05',
                                                                },
                                                            ],
                                                            Name: [{ _: 'IGV' }],
                                                            TaxTypeCode: [{ _: 'VAT' }],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],

                            Item: [
                                {
                                    Description: [
                                        {
                                            _: `${description} - Talla ${detail.size}`,
                                        },
                                    ],
                                    SellersItemIdentification: [
                                        {
                                            ID: [{ _: articleCode }],
                                        },
                                    ],
                                },
                            ],

                            Price: [
                                {
                                    PriceAmount: [
                                        {
                                            _: unitPriceWithoutIgv,
                                            currencyID: 'PEN',
                                        },
                                    ],
                                },
                            ],
                        };
                    }),
                },
            ],
        };
    }

    private getCustomerDocumentType(document: string) {
        const value = String(document || '').trim();

        if (value.length === 8) return '1'; // DNI
        if (value.length === 11) return '6'; // RUC

        return '0'; // Sin documento / otros
    }

    async getPdfBySaleId(saleId: number): Promise<Buffer> {
        const invoice = await this.invoiceRepository.findOne({
            where: { sale_id: saleId },
        });

        if (!invoice || !invoice.efact_ticket) {
            throw new NotFoundException('La venta no tiene boleta generada');
        }

        const accessToken = await this.getAccessToken();

        const pdfBaseUrl = this.configService.get<string>('EFACT_PDF_URL');

        const response = await axios.get(
            `${pdfBaseUrl}/${invoice.efact_ticket}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'arraybuffer',
            },
        );

        return Buffer.from(response.data);
    }
}