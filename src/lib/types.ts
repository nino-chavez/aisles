/** Product shape used by layout components — transformed from BC data */
export interface Product {
	id: string;
	entityId: number;
	name: string;
	price: number;
	salePrice?: number;
	image: string;
	imageAlt: string;
	description: string;
	specs: Record<string, string>;
	tags: string[];
	category: string;
}
