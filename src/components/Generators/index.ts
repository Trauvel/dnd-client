import { MerchantGoodsGenerator } from './MerchantGoodsGenerator';
import { NpcGenerator } from './NpcGenerator';
import { TreasureGenerator } from './TreasureGenerator';

export const GENERATORS = [
  { id: 'merchant-goods', title: 'Список товаров торговца', component: MerchantGoodsGenerator },
  { id: 'npc', title: 'NPC', component: NpcGenerator },
  { id: 'treasure', title: 'Сокровища', component: TreasureGenerator },
] as const;

export type GeneratorId = typeof GENERATORS[number]['id'];
export { MerchantGoodsGenerator, NpcGenerator, TreasureGenerator };
