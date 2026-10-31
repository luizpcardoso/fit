import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({context}:{context:QueryInterface}){
  await context.createTable('injectables',{
    id:{type:DataTypes.STRING(36),primaryKey:true,allowNull:false},
    user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},
    name:{type:DataTypes.STRING(100),allowNull:false},
    dose:{type:DataTypes.DECIMAL(12,3),allowNull:false},
    unit:{type:DataTypes.ENUM('mg','ml','iu','clicks','other'),allowNull:false},
    custom_unit:{type:DataTypes.STRING(30),allowNull:true},
    weekdays_json:{type:DataTypes.TEXT,allowNull:false},
    half_life_days:{type:DataTypes.DECIMAL(7,2),allowNull:false},
    notes:{type:DataTypes.STRING(500),allowNull:true},
    active:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},
    created_at:{type:DataTypes.DATE,allowNull:false},updated_at:{type:DataTypes.DATE,allowNull:false},
  });
  await context.createTable('injectable_applications',{
    id:{type:DataTypes.STRING(36),primaryKey:true,allowNull:false},
    user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},
    injectable_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'injectables',key:'id'},onDelete:'CASCADE'},
    application_date:{type:DataTypes.DATEONLY,allowNull:false},
    dose:{type:DataTypes.DECIMAL(12,3),allowNull:false},
    unit:{type:DataTypes.ENUM('mg','ml','iu','clicks','other'),allowNull:false},
    custom_unit:{type:DataTypes.STRING(30),allowNull:true},
    applied_at:{type:DataTypes.DATE,allowNull:false},created_at:{type:DataTypes.DATE,allowNull:false},
  });
  await context.addConstraint('injectable_applications',{fields:['injectable_id','application_date'],type:'unique',name:'injectable_applications_item_date_unique'});
  await context.addIndex('injectables',['user_id','active'],{name:'injectables_user_active_idx'});
  await context.addIndex('injectable_applications',['user_id','application_date'],{name:'injectable_applications_user_date_idx'});
}

export async function down({context}:{context:QueryInterface}){await context.dropTable('injectable_applications');await context.dropTable('injectables')}
