type RuntimeEnv = typeof globalThis & {
	__env?: {
		API_BASE_URL?: string;
	};
};

const runtimeEnv = globalThis as RuntimeEnv;
const metaEnv = (import.meta as ImportMeta & {
	env?: Record<string, string | undefined>;
}).env;

export const environment = {
	apiBaseUrl:
		runtimeEnv.__env?.API_BASE_URL ??
		metaEnv?.['API_BASE_URL'] ??
		metaEnv?.['VITE_API_BASE_URL'] ??
		'https://back-secundaria.onrender.com'
};