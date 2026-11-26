import {BadRequestException,Injectable,UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {OAuth2Client} from 'google-auth-library';
import {DataSource} from 'typeorm';
import {EcommerceCustomer} from '../database/entities/ecommerce-customer.entity';
import {EcommerceOrder} from '../database/entities/ecommerce-order.entity';
import {Storefront} from '../database/entities/storefront.entity';
import {GoogleCustomerLoginDto,UpdateCustomerProfileDto} from './dto/customer-auth.dto';

@Injectable()
export class StorefrontCustomerAuthService{
 private readonly jwt=new JwtService();
 constructor(private readonly dataSource:DataSource,private readonly config:ConfigService){}
 private secret(){const value=this.config.get<string>('CUSTOMER_JWT_SECRET')||this.config.get<string>('JWT_SECRET');if(!value||value.length<32)throw new Error('CUSTOMER_JWT_SECRET debe tener al menos 32 caracteres');return value}
 async loginGoogle(slug:string,dto:GoogleCustomerLoginDto){
  if(!dto.privacy_accepted)throw new BadRequestException('Debes aceptar la Política de Privacidad');
  const clientId=this.config.get<string>('GOOGLE_CLIENT_ID');if(!clientId)throw new BadRequestException('El inicio con Google todavía no está configurado');
  const ticket=await new OAuth2Client(clientId).verifyIdToken({idToken:dto.credential,audience:clientId}).catch(()=>null);
  const payload=ticket?.getPayload();if(!payload?.sub||!payload.email||!payload.email_verified)throw new UnauthorizedException('No se pudo verificar la cuenta de Google');
  const store=await this.dataSource.getRepository(Storefront).findOne({where:{slug,status:true}});if(!store)throw new BadRequestException('Tienda no disponible');
  const repo=this.dataSource.getRepository(EcommerceCustomer);
  let customer=await repo.findOne({where:[{storefront_id:store.id,google_subject:payload.sub},{storefront_id:store.id,email:payload.email.toLowerCase()}]});
  const now=new Date();
  if(!customer)customer=repo.create({storefront_id:store.id,google_subject:payload.sub,email:payload.email.toLowerCase(),email_verified:true,full_name:(payload.name||payload.email).trim(),picture_url:payload.picture||null,marketing_consent:dto.marketing_consent===true,privacy_accepted_at_utc:now,last_login_at_utc:now,status:true});
  else{if(!customer.status)throw new UnauthorizedException('La cuenta está deshabilitada');customer.google_subject=payload.sub;customer.email_verified=true;customer.full_name=customer.full_name||payload.name||payload.email;customer.picture_url=payload.picture||customer.picture_url;customer.last_login_at_utc=now;if(dto.marketing_consent===true)customer.marketing_consent=true;if(!customer.privacy_accepted_at_utc)customer.privacy_accepted_at_utc=now}
  customer=await repo.save(customer);
  const access_token=await this.jwt.signAsync({sub:customer.id,storefrontId:store.id,type:'ecommerce_customer'},{secret:this.secret(),expiresIn:(this.config.get<string>('CUSTOMER_JWT_EXPIRES_IN')||'30d') as any,issuer:'verco-storefront',audience:'soomin-customer'});
  return{access_token,customer:this.publicCustomer(customer)};
 }
 async authenticate(slug:string,authorization?:string){
  const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';if(!token)throw new UnauthorizedException('Inicia sesión para continuar');
  const claims=await this.jwt.verifyAsync<{sub:number;storefrontId:number;type:string}>(token,{secret:this.secret(),issuer:'verco-storefront',audience:'soomin-customer'}).catch(()=>null);
  if(!claims||claims.type!=='ecommerce_customer')throw new UnauthorizedException('La sesión no es válida o expiró');
  const store=await this.dataSource.getRepository(Storefront).findOne({where:{slug,status:true}});if(!store||store.id!==claims.storefrontId)throw new UnauthorizedException('Sesión no válida para esta tienda');
  const customer=await this.dataSource.getRepository(EcommerceCustomer).findOne({where:{id:claims.sub,storefront_id:store.id,status:true}});if(!customer)throw new UnauthorizedException('Cliente no disponible');return customer;
 }
 async optionalCustomerId(slug:string,authorization?:string){if(!authorization)return null;return (await this.authenticate(slug,authorization)).id}
 async me(slug:string,authorization?:string){return this.publicCustomer(await this.authenticate(slug,authorization))}
 async update(slug:string,authorization:string|undefined,dto:UpdateCustomerProfileDto){const customer=await this.authenticate(slug,authorization);for(const key of Object.keys(dto) as Array<keyof UpdateCustomerProfileDto>){const value=dto[key];if(typeof value==='string')(customer as any)[key]=value.trim()||null;else if(typeof value==='boolean')(customer as any)[key]=value}return this.publicCustomer(await this.dataSource.getRepository(EcommerceCustomer).save(customer))}
 async orders(slug:string,authorization?:string){const customer=await this.authenticate(slug,authorization);return this.dataSource.getRepository(EcommerceOrder).find({where:{customer_id:customer.id,storefront_id:customer.storefront_id},relations:{details:true},order:{created_at:'DESC'}})}
 private publicCustomer(c:EcommerceCustomer){return{id:c.id,email:c.email,full_name:c.full_name,picture_url:c.picture_url,phone:c.phone,document_type:c.document_type,document_number:c.document_number,address:c.address,department:c.department,department_code:c.department_code,province:c.province,province_code:c.province_code,district:c.district,district_code:c.district_code,marketing_consent:c.marketing_consent}}
}
