import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { MealType } from './mealTypes';

export interface LoggableFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export async function createFoodLogEntry(userId: string, food: LoggableFood, mealType: MealType) {
  await addDoc(collection(db, 'foodLogs'), {
    userId,
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fats: food.fats,
    mealType,
    timestamp: new Date().toISOString(),
  });
}
