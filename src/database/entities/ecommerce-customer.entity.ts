import {Column,CreateDateColumn,Entity,Index,PrimaryGeneratedColumn,UpdateDateColumn} from 'typeorm';

@Entity('EcommerceCustomers')
@Index('uq_ecommerce_customer_google',['storefront_id','google_subject'],{unique:true})
@Index('uq_ecommerce_customer_email',['storefront_id','email'],{unique:true})
export class EcommerceCustomer{
 @PrimaryGeneratedColumn() id!:number;
 @Column({type:'int'}) storefront_id!:number;
 @Column({type:'varchar',length:255}) google_subject!:string;
 @Column({type:'varchar',length:190}) email!:string;
 @Column({type:'boolean',default:true}) email_verified!:boolean;
 @Column({type:'varchar',length:180}) full_name!:string;
 @Column({type:'varchar',length:500,nullable:true}) picture_url!:string|null;
 @Column({type:'varchar',length:30,nullable:true}) phone!:string|null;
 @Column({type:'varchar',length:10,nullable:true}) document_type!:string|null;
 @Column({type:'varchar',length:20,nullable:true}) document_number!:string|null;
 @Column({type:'varchar',length:255,nullable:true}) address!:string|null;
 @Column({type:'varchar',length:100,nullable:true}) department!:string|null;
 @Column({type:'varchar',length:6,nullable:true}) department_code!:string|null;
 @Column({type:'varchar',length:100,nullable:true}) province!:string|null;
 @Column({type:'varchar',length:6,nullable:true}) province_code!:string|null;
 @Column({type:'varchar',length:100,nullable:true}) district!:string|null;
 @Column({type:'varchar',length:6,nullable:true}) district_code!:string|null;
 @Column({type:'boolean',default:false}) marketing_consent!:boolean;
 @Column({type:'datetime',precision:3,nullable:true}) privacy_accepted_at_utc!:Date|null;
 @Column({type:'datetime',precision:3}) last_login_at_utc!:Date;
 @Column({type:'boolean',default:true}) status!:boolean;
 @CreateDateColumn({type:'datetime',precision:3}) created_at!:Date;
 @UpdateDateColumn({type:'datetime',precision:3}) updated_at!:Date;
}
