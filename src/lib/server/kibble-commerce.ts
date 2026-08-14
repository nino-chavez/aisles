import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';

/**
 * Kibble commerce is opt-in. Missing or invalid configuration stays off.
 * `sandbox` and `live` are deployment decisions, not browser-controlled input.
 */
export type KibbleCommerceMode = 'off' | 'sandbox' | 'live';

export function kibbleCommerceModeFromValue(value: string | undefined): KibbleCommerceMode {
	return value === 'sandbox' || value === 'live' ? value : 'off';
}

export function getKibbleCommerceMode(): KibbleCommerceMode {
	return kibbleCommerceModeFromValue(env.KIBBLE_COMMERCE_MODE);
}

export function isKibbleCommerceEnabled(): boolean {
	return getKibbleCommerceMode() !== 'off';
}

export type CommerceMoney = {
	value: number;
	currencyCode: string;
};

export type CommerceSelectedOption = {
	entityId: number;
	name: string;
	value: string | null;
	valueEntityId: number | null;
};

export type KibbleCartLine = {
	entityId: string;
	parentEntityId: string | null;
	variantEntityId: number | null;
	productEntityId: number;
	sku: string | null;
	name: string;
	path: string | null;
	imageUrl: string | null;
	quantity: number;
	listPrice: CommerceMoney;
	salePrice: CommerceMoney | null;
	extendedListPrice: CommerceMoney;
	extendedSalePrice: CommerceMoney | null;
	selectedOptions: CommerceSelectedOption[];
};

export type KibbleCart = {
	entityId: string;
	currencyCode: string;
	baseAmount: CommerceMoney;
	discountedAmount: CommerceMoney;
	amount: CommerceMoney;
	lineItems: {
		physicalItems: KibbleCartLine[];
		totalQuantity: number;
	};
};

export type KibbleCartLineInput = {
	productEntityId: number;
	quantity: number;
	variantEntityId?: number;
	selectedOptions?: {
		multipleChoices: Array<{ optionEntityId: number; optionValueEntityId: number }>;
	};
};

export type KibbleCartMutationResult = {
	cart: KibbleCart;
	sessionCookie: string | null;
};

export type KibbleCustomer = {
	entityId: number;
	firstName: string;
	lastName: string;
	email: string;
};

export type KibbleCustomerLoginResult = {
	customer: KibbleCustomer;
	accessToken: string;
	accessTokenExpiresAt: string | null;
	cartEntityId: string | null;
	sessionCookie: string | null;
};

export type KibbleCustomerOrder = {
	entityId: number;
	updatedAt: string | null;
	subTotal: CommerceMoney | null;
	totalIncTax: CommerceMoney | null;
	itemCount: number;
};

type GraphQLResponse<T> = {
	data: T;
	errors?: Array<{ message: string }>;
};

type CommerceRequestOptions = {
	sessionCookie?: string | null;
	customerAccessToken?: string | null;
};

export class KibbleCommerceError extends Error {
	readonly status: number;
	readonly kind: 'configuration' | 'provider' | 'stale-cart' | 'validation' | 'authentication';

	constructor(message: string, status = 502, kind: KibbleCommerceError['kind'] = 'provider') {
		super(message);
		this.name = 'KibbleCommerceError';
		this.status = status;
		this.kind = kind;
	}
}

function getCommerceGraphQLConfig() {
	const brand = getBrand();
	const storeHash = env.BIGCOMMERCE_STORE_HASH;
	const privateToken = env.BIGCOMMERCE_PRIVATE_TOKEN;

	if (!storeHash) throw new KibbleCommerceError('Commerce store is not configured.', 503, 'configuration');
	if (!privateToken) throw new KibbleCommerceError('Commerce service is not configured.', 503, 'configuration');

	const channelId = brand.bc.channelId;
	const host = channelId === 1
		? `store-${storeHash}.mybigcommerce.com`
		: `store-${storeHash}-${channelId}.mybigcommerce.com`;

	return { url: `https://${host}/graphql`, token: privateToken };
}

function extractSessionCookie(headers: Headers): string | null {
	const raw = typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
		? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
		: headers.get('set-cookie')?.split(/,(?=\s*[A-Za-z0-9_\-]+=)/) ?? [];
	const parts = raw.map((cookie) => cookie.split(';')[0].trim()).filter(Boolean);
	return parts.length > 0 ? parts.join('; ') : null;
}

/**
 * BigCommerce documents private tokens for server-to-server/headless calls,
 * and customer access tokens are sent only in this server-side header. See:
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/authentication
 */
async function commerceQuery<T>(
	gql: string,
	variables: Record<string, unknown> | undefined,
	options: CommerceRequestOptions = {},
): Promise<{ data: T; sessionCookie: string | null }> {
	const { url, token } = getCommerceGraphQLConfig();
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`,
	};
	if (options.sessionCookie) headers.Cookie = options.sessionCookie;
	if (options.customerAccessToken) headers['X-Bc-Customer-Access-Token'] = options.customerAccessToken;

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ query: gql, variables }),
	});
	if (!response.ok) {
		throw new KibbleCommerceError(
			`Commerce provider returned HTTP ${response.status}.`,
			response.status >= 500 ? 502 : response.status,
			response.status === 401 ? 'authentication' : response.status === 404 ? 'stale-cart' : 'provider',
		);
	}

	const payload = await response.json() as GraphQLResponse<T>;
	if (payload.errors?.length) {
		const rawMessage = payload.errors[0].message.toLowerCase();
		const stale = /cart.*(not found|does not exist)|not found.*cart/.test(rawMessage);
		const authentication = /authentication|credential|password|login|customer.*(not authorized|not logged)/.test(rawMessage);
		throw new KibbleCommerceError(
			authentication ? 'Commerce provider rejected the customer credentials.' : 'Commerce provider rejected the operation.',
			authentication ? 401 : stale ? 404 : 502,
			authentication ? 'authentication' : stale ? 'stale-cart' : 'provider',
		);
	}
	return { data: payload.data, sessionCookie: extractSessionCookie(response.headers) };
}

const CART_FIELDS = `
	entityId
	currencyCode
	baseAmount { value currencyCode }
	discountedAmount { value currencyCode }
	amount { value currencyCode }
	lineItems {
		physicalItems {
			entityId
			parentEntityId
			variantEntityId
			productEntityId
			sku
			name
			path
			imageUrl
			quantity
			listPrice { value currencyCode }
			salePrice { value currencyCode }
			extendedListPrice { value currencyCode }
			extendedSalePrice { value currencyCode }
			selectedOptions {
				entityId
				name
				... on CartSelectedMultipleChoiceOption { value valueEntityId }
			}
		}
		totalQuantity
	}
`;

export async function createKibbleCart(
	lineItem: KibbleCartLineInput,
	options?: CommerceRequestOptions,
): Promise<KibbleCartMutationResult> {
	const { data, sessionCookie } = await commerceQuery<{ cart: { createCart: { cart: KibbleCart | null } } }>(`
		mutation CreateCart($input: CreateCartInput!) {
			cart { createCart(input: $input) { cart { ${CART_FIELDS} } } }
		}
	`, { input: { lineItems: [lineItem] } }, options);
	const cart = data.cart.createCart.cart;
	if (!cart) throw new KibbleCommerceError('Commerce provider did not return a cart.');
	return { cart, sessionCookie };
}

export async function addKibbleCartLine(
	cartEntityId: string,
	lineItem: KibbleCartLineInput,
	options?: CommerceRequestOptions,
): Promise<KibbleCartMutationResult> {
	const { data, sessionCookie } = await commerceQuery<{ cart: { addCartLineItems: { cart: KibbleCart | null } } }>(`
		mutation AddCartLine($input: AddCartLineItemsInput!) {
			cart { addCartLineItems(input: $input) { cart { ${CART_FIELDS} } } }
		}
	`, { input: { cartEntityId, data: { lineItems: [lineItem] } } }, options);
	const cart = data.cart.addCartLineItems.cart;
	if (!cart) throw new KibbleCommerceError('Commerce provider did not return an updated cart.');
	return { cart, sessionCookie };
}

export async function updateKibbleCartLine(
	cartEntityId: string,
	lineItemEntityId: string,
	lineItem: KibbleCartLineInput,
	options?: CommerceRequestOptions,
): Promise<KibbleCartMutationResult> {
	const { data, sessionCookie } = await commerceQuery<{ cart: { updateCartLineItem: { cart: KibbleCart | null } } }>(`
		mutation UpdateCartLine($cartId: String!, $lineId: String!, $lineItem: CartLineItemInput!) {
			cart {
				updateCartLineItem(input: {
					cartEntityId: $cartId,
					lineItemEntityId: $lineId,
					data: { lineItem: $lineItem }
				}) { cart { ${CART_FIELDS} } }
			}
		}
	`, { cartId: cartEntityId, lineId: lineItemEntityId, lineItem }, options);
	const cart = data.cart.updateCartLineItem.cart;
	if (!cart) throw new KibbleCommerceError('Commerce provider did not return an updated cart.');
	return { cart, sessionCookie };
}

export async function deleteKibbleCartLine(
	cartEntityId: string,
	lineItemEntityId: string,
	options?: CommerceRequestOptions,
): Promise<{ cart: KibbleCart | null; sessionCookie: string | null }> {
	const { data, sessionCookie } = await commerceQuery<{ cart: { deleteCartLineItem: { cart: KibbleCart | null } } }>(`
		mutation DeleteCartLine($cartId: String!, $lineId: String!) {
			cart {
				deleteCartLineItem(input: { cartEntityId: $cartId, lineItemEntityId: $lineId }) {
					cart { ${CART_FIELDS} }
				}
			}
		}
	`, { cartId: cartEntityId, lineId: lineItemEntityId }, options);
	return { cart: data.cart.deleteCartLineItem.cart, sessionCookie };
}

export async function getKibbleCart(
	cartEntityId: string,
	options?: CommerceRequestOptions,
): Promise<{ cart: KibbleCart | null; sessionCookie: string | null }> {
	const { data, sessionCookie } = await commerceQuery<{ site: { cart: KibbleCart | null } }>(`
		query GetCart($cartId: String!) {
			site { cart(entityId: $cartId) { ${CART_FIELDS} } }
		}
	`, { cartId: cartEntityId }, options);
	return { cart: data.site.cart, sessionCookie };
}

/**
 * BigCommerce documents this as a just-in-time, single-use hosted-checkout
 * handoff. The browser receives only the provider URL; it never receives the
 * private token or constructs a checkout URL.
 * https://docs.bigcommerce.com/developer/docs/admin/checkout-and-cart/custom-checkouts/graphql-storefront
 */
export async function createKibbleCheckoutRedirect(
	cartEntityId: string,
	options?: CommerceRequestOptions,
): Promise<string> {
	const { data } = await commerceQuery<{ cart: { createCartRedirectUrls: { redirectUrls: { redirectedCheckoutUrl: string | null } | null } } }>(`
		mutation CartRedirectUrls($cartId: String!) {
			cart {
				createCartRedirectUrls(input: { cartEntityId: $cartId }) {
					redirectUrls { redirectedCheckoutUrl }
				}
			}
		}
	`, { cartId: cartEntityId }, options);
	const url = data.cart.createCartRedirectUrls.redirectUrls?.redirectedCheckoutUrl;
	if (!url || !url.startsWith('https://')) throw new KibbleCommerceError('Commerce provider did not return a checkout URL.');
	return url;
}

/**
 * Verified against the current BigCommerce Storefront GraphQL customer login
 * contract: https://docs.bigcommerce.com/developer/api-reference/graphql/storefront/mutations/login
 * and server-side token handling:
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/authentication
 */
export async function loginKibbleCustomer(
	email: string,
	password: string,
	guestCartEntityId: string | null,
	options?: CommerceRequestOptions,
): Promise<KibbleCustomerLoginResult | null> {
	const { data, sessionCookie } = await commerceQuery<{
		login: {
			customer: KibbleCustomer | null;
			customerAccessToken: { value: string; expiresAt: string | null } | null;
			cart: { entityId: string } | null;
		} | null;
	}>(`
		mutation CustomerLogin($email: String!, $password: String!, $guestCartEntityId: String) {
			login(email: $email, password: $password, guestCartEntityId: $guestCartEntityId) {
				customer { entityId firstName lastName email }
				cart { entityId }
				customerAccessToken { value expiresAt }
			}
		}
	`, { email, password, guestCartEntityId }, options);
	const result = data.login;
	if (!result?.customer || !result.customerAccessToken?.value) return null;
	return {
		customer: result.customer,
		accessToken: result.customerAccessToken.value,
		accessTokenExpiresAt: result.customerAccessToken.expiresAt,
		cartEntityId: result.cart?.entityId ?? null,
		sessionCookie: sessionCookie,
	};
}

/**
 * Verified against the current BigCommerce GraphQL Storefront customer guide:
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/customers
 * Registration errors are provider-owned; this adapter returns only safe text.
 */
export async function registerKibbleCustomer(input: {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
}): Promise<{ customer: KibbleCustomer | null; errors: string[] }> {
	const { data } = await commerceQuery<{
		customer: {
			registerCustomer: {
				customer: KibbleCustomer | null;
				errors: Array<{ message: string }>;
			};
		};
	}>(`
		mutation RegisterCustomer($input: RegisterCustomerInput!) {
			customer {
				registerCustomer(input: $input) {
					customer { entityId firstName lastName email }
					errors {
						__typename
						... on ValidationError { message }
						... on CustomerRegistrationError { message }
						... on EmailAlreadyInUseError { message }
						... on AccountCreationDisabledError { message }
					}
				}
			}
		}
	`, { input });
	const result = data.customer.registerCustomer;
	return { customer: result.customer, errors: result.errors.map(({ message }) => message).filter(Boolean) };
}

/** BigCommerce invalidates the customer access token when this server-side logout runs. */
export async function logoutKibbleCustomer(
	accessToken: string,
	options?: CommerceRequestOptions,
): Promise<void> {
	await commerceQuery<{ logout: { result: string | null } }>(`
		mutation CustomerLogout {
			logout { result }
		}
	`, undefined, { ...options, customerAccessToken: accessToken });
}

/**
 * The Storefront GraphQL orders surface is currently documented as beta:
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/orders
 * Keep the response summary narrow and customer-context-bound.
 */
export async function getKibbleCustomerOrders(
	accessToken: string,
	options?: CommerceRequestOptions,
): Promise<KibbleCustomerOrder[]> {
	const { data } = await commerceQuery<{
		customer: {
			orders: {
				edges: Array<{ node: {
					entityId: number;
					updatedAt: { utc: string } | null;
					subTotal: CommerceMoney | null;
					totalIncTax: CommerceMoney | null;
					consignments: { shipping: { edges: Array<{ node: { lineItems: { edges: Array<{ node: { quantity: number } }> } } }> } };
				} }>;
			};
		} | null;
	}>(`
		query CustomerOrders {
			customer {
				orders {
					edges {
						node {
						entityId
						updatedAt { utc }
						subTotal { value currencyCode }
						totalIncTax { value currencyCode }
						consignments {
							shipping {
								edges {
									node {
									lineItems { edges { node { quantity } } }
								}
							}
							}
						}
					}
				}
			}
		}
	`, undefined, { ...options, customerAccessToken: accessToken });
	return data.customer?.orders.edges.map(({ node }) => ({
		entityId: node.entityId,
		updatedAt: node.updatedAt?.utc ?? null,
		subTotal: node.subTotal,
		totalIncTax: node.totalIncTax,
		itemCount: node.consignments.shipping.edges
			.flatMap(({ node: consignment }) => consignment.lineItems.edges)
			.reduce((sum, { node: line }) => sum + line.quantity, 0),
	})) ?? [];
}
