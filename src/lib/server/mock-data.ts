export interface Product {
	id: string;
	name: string;
	price: number;
	salePrice?: number;
	image: string;
	category: string;
	tags: string[];
	personaFit: {
		gatherer: number;
		hunter: number;
		researcher: number;
		gifter: number;
	};
	specs?: Record<string, string>;
	description: string;
}

export const mockProducts: Product[] = [
	// Living Room
	{
		id: 'lr-001',
		name: 'Modern Leather Sectional',
		price: 2499,
		image: '/products/sectional-placeholder.svg',
		category: 'living-room',
		tags: ['modern', 'leather', 'sectional', 'premium'],
		personaFit: { gatherer: 0.95, hunter: 0.4, researcher: 0.7, gifter: 0.3 },
		specs: { 'Material': 'Top-grain leather', 'Seats': '5', 'Dimensions': '112" x 85"', 'Weight': '180 lbs' },
		description: 'Clean-lined sectional in top-grain leather with reversible chaise. Solid hardwood frame.',
	},
	{
		id: 'lr-002',
		name: 'Velvet Lounge Sofa',
		price: 1899,
		salePrice: 1599,
		image: '/products/sofa-placeholder.svg',
		category: 'living-room',
		tags: ['modern', 'velvet', 'sofa', 'mid-range'],
		personaFit: { gatherer: 0.9, hunter: 0.5, researcher: 0.6, gifter: 0.4 },
		specs: { 'Material': 'Performance velvet', 'Seats': '3', 'Dimensions': '84" x 36"', 'Weight': '120 lbs' },
		description: 'Sculptural sofa with deep seat and bolster arms. Performance velvet resists stains.',
	},
	{
		id: 'lr-003',
		name: 'Walnut Coffee Table',
		price: 649,
		image: '/products/table-placeholder.svg',
		category: 'living-room',
		tags: ['modern', 'wood', 'table', 'mid-range'],
		personaFit: { gatherer: 0.85, hunter: 0.6, researcher: 0.5, gifter: 0.7 },
		specs: { 'Material': 'Solid walnut', 'Dimensions': '48" x 24" x 16"', 'Weight': '45 lbs' },
		description: 'Solid walnut coffee table with waterfall edge and matte lacquer finish.',
	},
	{
		id: 'lr-004',
		name: 'Linen Accent Chair',
		price: 799,
		image: '/products/chair-placeholder.svg',
		category: 'living-room',
		tags: ['modern', 'linen', 'chair', 'mid-range'],
		personaFit: { gatherer: 0.88, hunter: 0.45, researcher: 0.5, gifter: 0.65 },
		specs: { 'Material': 'Belgian linen', 'Dimensions': '32" x 30" x 33"', 'Weight': '42 lbs' },
		description: 'Sculptural accent chair with winged back. Belgian linen upholstery.',
	},
	{
		id: 'lr-005',
		name: 'Modular Sofa System',
		price: 3299,
		image: '/products/modular-placeholder.svg',
		category: 'living-room',
		tags: ['modern', 'modular', 'sofa', 'premium'],
		personaFit: { gatherer: 0.92, hunter: 0.35, researcher: 0.85, gifter: 0.2 },
		specs: { 'Material': 'Bouclé fabric', 'Seats': '6 (configurable)', 'Modules': '4', 'Weight': '210 lbs' },
		description: 'Four-piece modular system. Rearrange for any room. Bouclé fabric with removable covers.',
	},
	{
		id: 'lr-006',
		name: 'Marble Side Table',
		price: 349,
		image: '/products/sidetable-placeholder.svg',
		category: 'living-room',
		tags: ['modern', 'marble', 'table', 'affordable'],
		personaFit: { gatherer: 0.8, hunter: 0.7, researcher: 0.4, gifter: 0.8 },
		specs: { 'Material': 'Carrara marble top, brass base', 'Dimensions': '16" x 16" x 22"' },
		description: 'Round side table with genuine Carrara marble top and brushed brass pedestal base.',
	},
	{
		id: 'lr-007',
		name: 'Floor Lamp — Arc',
		price: 289,
		image: '/products/lamp-placeholder.svg',
		category: 'living-room',
		tags: ['modern', 'lighting', 'affordable'],
		personaFit: { gatherer: 0.75, hunter: 0.65, researcher: 0.3, gifter: 0.85 },
		specs: { 'Height': '72"', 'Bulb': 'E26 (not included)', 'Material': 'Brushed steel' },
		description: 'Overarching floor lamp with linen drum shade. Adjustable height.',
	},
	// Office / Dorm
	{
		id: 'of-001',
		name: 'Compact Student Desk',
		price: 129,
		image: '/products/desk-placeholder.svg',
		category: 'office',
		tags: ['compact', 'desk', 'dorm', 'budget'],
		personaFit: { gatherer: 0.3, hunter: 0.95, researcher: 0.6, gifter: 0.7 },
		specs: { 'Material': 'Engineered wood + steel', 'Dimensions': '48" x 24" x 30"', 'Weight': '35 lbs' },
		description: 'Space-efficient desk with cable management tray. Fits standard dorm rooms.',
	},
	{
		id: 'of-002',
		name: 'Ergonomic Task Chair',
		price: 249,
		image: '/products/taskchair-placeholder.svg',
		category: 'office',
		tags: ['ergonomic', 'chair', 'office', 'mid-range'],
		personaFit: { gatherer: 0.4, hunter: 0.8, researcher: 0.85, gifter: 0.5 },
		specs: { 'Material': 'Mesh back, foam seat', 'Adjustable': 'Height, lumbar, armrests', 'Weight capacity': '275 lbs' },
		description: 'Breathable mesh task chair with adjustable lumbar support. 5-year warranty.',
	},
	{
		id: 'of-003',
		name: 'Twin Bed Frame — Platform',
		price: 149,
		image: '/products/bedframe-placeholder.svg',
		category: 'office',
		tags: ['bed', 'twin', 'dorm', 'budget', 'compact'],
		personaFit: { gatherer: 0.2, hunter: 0.9, researcher: 0.5, gifter: 0.6 },
		specs: { 'Size': 'Twin', 'Material': 'Steel frame', 'Under-bed clearance': '12"', 'Weight capacity': '350 lbs' },
		description: 'Low-profile platform bed frame. No box spring needed. 12" under-bed storage clearance.',
	},
	{
		id: 'of-004',
		name: '3-Drawer Storage Cart',
		price: 89,
		image: '/products/storage-placeholder.svg',
		category: 'office',
		tags: ['storage', 'compact', 'dorm', 'budget'],
		personaFit: { gatherer: 0.25, hunter: 0.92, researcher: 0.4, gifter: 0.55 },
		specs: { 'Material': 'Steel + fabric drawers', 'Dimensions': '18" x 12" x 28"', 'Drawers': '3' },
		description: 'Rolling storage cart with 3 fabric drawers. Fits under most desks.',
	},
	{
		id: 'of-005',
		name: 'LED Desk Lamp',
		price: 39,
		image: '/products/desklamp-placeholder.svg',
		category: 'office',
		tags: ['lighting', 'desk', 'dorm', 'budget'],
		personaFit: { gatherer: 0.35, hunter: 0.88, researcher: 0.5, gifter: 0.75 },
		specs: { 'Light': '3 color temps, 5 brightness levels', 'USB': 'Charging port built-in', 'Power': '10W LED' },
		description: 'Adjustable LED desk lamp with USB charging port. 3 color temperatures.',
	},
	{
		id: 'of-006',
		name: 'Standing Desk — Electric',
		price: 599,
		image: '/products/standingdesk-placeholder.svg',
		category: 'office',
		tags: ['desk', 'standing', 'electric', 'premium', 'ergonomic'],
		personaFit: { gatherer: 0.5, hunter: 0.6, researcher: 0.9, gifter: 0.4 },
		specs: { 'Material': 'Bamboo top + steel frame', 'Range': '28" - 48"', 'Motor': 'Dual motor, 3 presets', 'Weight capacity': '300 lbs' },
		description: 'Electric sit-stand desk with dual motors, 3 memory presets, and bamboo desktop.',
	},
	{
		id: 'of-007',
		name: 'Bookshelf — 5 Tier',
		price: 79,
		image: '/products/bookshelf-placeholder.svg',
		category: 'office',
		tags: ['storage', 'bookshelf', 'dorm', 'budget', 'compact'],
		personaFit: { gatherer: 0.3, hunter: 0.85, researcher: 0.55, gifter: 0.5 },
		specs: { 'Material': 'Engineered wood + steel', 'Dimensions': '24" x 12" x 60"', 'Shelves': '5', 'Weight capacity': '50 lbs per shelf' },
		description: '5-tier open bookshelf. Industrial style. Anti-tip hardware included.',
	},
	{
		id: 'of-008',
		name: 'Monitor Stand + Organizer',
		price: 45,
		image: '/products/monitorstand-placeholder.svg',
		category: 'office',
		tags: ['desk', 'organizer', 'compact', 'budget'],
		personaFit: { gatherer: 0.3, hunter: 0.8, researcher: 0.6, gifter: 0.65 },
		specs: { 'Material': 'Bamboo', 'Slots': 'Phone, tablet, pens, storage drawer', 'Dimensions': '20" x 8" x 4"' },
		description: 'Desktop monitor riser with built-in organizer. Drawer + device slots.',
	},
];
