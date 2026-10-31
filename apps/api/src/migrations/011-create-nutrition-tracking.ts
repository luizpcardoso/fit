import { DataTypes, type QueryInterface } from 'sequelize';

const id = { type: DataTypes.STRING(36), primaryKey: true, allowNull: false };
const userId = { type: DataTypes.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' };
const timestamps = { created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } };
const nutrient = { type: DataTypes.DECIMAL(12, 3), allowNull: false };

export async function up({ context }: { context: QueryInterface }) {
  await context.createTable('foods', {
    id, user_id: userId, name: { type: DataTypes.STRING(120), allowNull: false }, brand: { type: DataTypes.STRING(120), allowNull: true },
    serving_amount: { type: DataTypes.DECIMAL(12, 3), allowNull: false }, serving_unit: { type: DataTypes.ENUM('g', 'ml', 'unit'), allowNull: false },
    calories: nutrient, protein: nutrient, carbs: nutrient, fat: nutrient, fiber: { ...nutrient, allowNull: true }, notes: { type: DataTypes.STRING(500), allowNull: true }, ...timestamps,
  });
  await context.addIndex('foods', ['user_id', 'name'], { name: 'foods_user_name_idx' });

  await context.createTable('meals', {
    id, user_id: userId, name: { type: DataTypes.STRING(120), allowNull: false }, meal_date: { type: DataTypes.DATEONLY, allowNull: false },
    meal_time: { type: DataTypes.TIME, allowNull: false }, mode: { type: DataTypes.ENUM('items', 'direct'), allowNull: false },
    calories: nutrient, protein: nutrient, carbs: nutrient, fat: nutrient, fiber: { ...nutrient, allowNull: true }, ...timestamps,
  });
  await context.addIndex('meals', ['user_id', 'meal_date', 'meal_time'], { name: 'meals_user_date_time_idx' });
  await context.createTable('meal_items', {
    id, meal_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'meals', key: 'id' }, onDelete: 'CASCADE' },
    food_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'foods', key: 'id' }, onDelete: 'SET NULL' },
    food_name: { type: DataTypes.STRING(120), allowNull: false }, serving_amount: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    serving_unit: { type: DataTypes.ENUM('g', 'ml', 'unit'), allowNull: false }, quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    calories: nutrient, protein: nutrient, carbs: nutrient, fat: nutrient, fiber: { ...nutrient, allowNull: true }, created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addIndex('meal_items', ['meal_id'], { name: 'meal_items_meal_idx' });

  await context.createTable('favorite_meals', {
    id, user_id: userId, name: { type: DataTypes.STRING(120), allowNull: false }, mode: { type: DataTypes.ENUM('items', 'direct'), allowNull: false },
    calories: nutrient, protein: nutrient, carbs: nutrient, fat: nutrient, fiber: { ...nutrient, allowNull: true }, ...timestamps,
  });
  await context.addIndex('favorite_meals', ['user_id', 'name'], { name: 'favorite_meals_user_name_idx' });
  await context.createTable('favorite_meal_items', {
    id, favorite_id: { type: DataTypes.STRING(36), allowNull: false, references: { model: 'favorite_meals', key: 'id' }, onDelete: 'CASCADE' },
    food_id: { type: DataTypes.STRING(36), allowNull: true, references: { model: 'foods', key: 'id' }, onDelete: 'SET NULL' },
    food_name: { type: DataTypes.STRING(120), allowNull: false }, serving_amount: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    serving_unit: { type: DataTypes.ENUM('g', 'ml', 'unit'), allowNull: false }, quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    calories: nutrient, protein: nutrient, carbs: nutrient, fat: nutrient, fiber: { ...nutrient, allowNull: true }, created_at: { type: DataTypes.DATE, allowNull: false },
  });
  await context.addIndex('favorite_meal_items', ['favorite_id'], { name: 'favorite_meal_items_favorite_idx' });

  await context.createTable('daily_expenditures', {
    id, user_id: userId, expenditure_date: { type: DataTypes.DATEONLY, allowNull: false }, mode: { type: DataTypes.ENUM('manual', 'estimated'), allowNull: false },
    total_calories: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, source: { type: DataTypes.STRING(120), allowNull: true },
    basal_calories: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, activity_calories: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, exercise_calories: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    formula: { type: DataTypes.STRING(120), allowNull: true }, gender: { type: DataTypes.ENUM('female', 'male'), allowNull: true }, birth_date: { type: DataTypes.DATEONLY, allowNull: true },
    height_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, weight_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, activity_level: { type: DataTypes.STRING(24), allowNull: true }, ...timestamps,
  });
  await context.addConstraint('daily_expenditures', { fields: ['user_id', 'expenditure_date'], type: 'unique', name: 'daily_expenditures_user_date_unique' });

  await context.createTable('body_measurements', {
    id, user_id: userId, measurement_date: { type: DataTypes.DATEONLY, allowNull: false }, weight_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    waist_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, abdomen_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, hips_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    chest_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, left_arm_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, right_arm_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    left_thigh_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, right_thigh_cm: { type: DataTypes.DECIMAL(6, 2), allowNull: true }, notes: { type: DataTypes.STRING(500), allowNull: true }, ...timestamps,
  });
  await context.addIndex('body_measurements', ['user_id', 'measurement_date'], { name: 'body_measurements_user_date_idx' });
}

export async function down({ context }: { context: QueryInterface }) {
  await context.dropTable('body_measurements'); await context.dropTable('daily_expenditures'); await context.dropTable('favorite_meal_items');
  await context.dropTable('favorite_meals'); await context.dropTable('meal_items'); await context.dropTable('meals'); await context.dropTable('foods');
}
