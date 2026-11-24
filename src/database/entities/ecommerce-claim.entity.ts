import {Column,CreateDateColumn,Entity,JoinColumn,ManyToOne,PrimaryGeneratedColumn,UpdateDateColumn} from 'typeorm';
import {Storefront} from './storefront.entity';

export enum EcommerceClaimStatus { REGISTERED='REGISTRADO', IN_PROGRESS='EN_ATENCION', ANSWERED='RESPONDIDO', CLOSED='CERRADO' }
@Entity('EcommerceClaims')
export class EcommerceClaim {
 @PrimaryGeneratedColumn({type:'bigint',unsigned:true}) id!:number;
 @Column({type:'varchar',length:40,nullable:true,unique:true}) claim_code!:string|null;
 @Column({type:'int'}) storefront_id!:number;
 @ManyToOne(()=>Storefront,{onDelete:'RESTRICT'}) @JoinColumn({name:'storefront_id'}) storefront!:Storefront;
 @Column({type:'enum',enum:['RECLAMO','QUEJA']}) claim_type!:'RECLAMO'|'QUEJA';
 @Column({type:'varchar',length:150}) consumer_name!:string;
 @Column({type:'varchar',length:20}) document_type!:string;
 @Column({type:'varchar',length:20}) document_number!:string;
 @Column({type:'varchar',length:255}) consumer_address!:string;
 @Column({type:'varchar',length:30}) consumer_phone!:string;
 @Column({type:'varchar',length:150}) consumer_email!:string;
 @Column({type:'boolean',default:false}) is_minor!:boolean;
 @Column({type:'varchar',length:150,nullable:true}) representative_name!:string|null;
 @Column({type:'varchar',length:20,nullable:true}) representative_document!:string|null;
 @Column({type:'enum',enum:['PRODUCTO','SERVICIO']}) item_type!:'PRODUCTO'|'SERVICIO';
 @Column({type:'varchar',length:500}) item_description!:string;
 @Column({type:'decimal',precision:12,scale:2,default:0}) amount!:string;
 @Column({type:'varchar',length:30,nullable:true}) order_code!:string|null;
 @Column({type:'text'}) detail!:string;
 @Column({type:'text'}) consumer_request!:string;
 @Column({type:'enum',enum:['EMAIL','DOMICILIO'],default:'EMAIL'}) response_method!:'EMAIL'|'DOMICILIO';
 @Column({type:'enum',enum:EcommerceClaimStatus,default:EcommerceClaimStatus.REGISTERED}) status!:EcommerceClaimStatus;
 @Column({type:'text',nullable:true}) provider_actions!:string|null;
 @Column({type:'text',nullable:true}) provider_response!:string|null;
 @Column({type:'datetime',nullable:true}) responded_at!:Date|null;
 @CreateDateColumn({type:'datetime'}) created_at!:Date;
 @UpdateDateColumn({type:'datetime'}) updated_at!:Date;
}
