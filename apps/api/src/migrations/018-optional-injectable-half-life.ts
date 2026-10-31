import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({context}:{context:QueryInterface}) {
  await context.changeColumn('injectables','half_life_days',{type:DataTypes.DECIMAL(7,2),allowNull:true});
}
export async function down({context}:{context:QueryInterface}) {
  const [rows]=await context.sequelize.query('SELECT id FROM injectables WHERE half_life_days IS NULL LIMIT 1');
  if(rows.length) throw new Error('Cannot restore required half-life while unspecified values exist.');
  await context.changeColumn('injectables','half_life_days',{type:DataTypes.DECIMAL(7,2),allowNull:false});
}
