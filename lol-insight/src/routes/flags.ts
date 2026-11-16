/**
 * EXPO_PUBLIC_WEB_LAYOUT=mobile gera a versão web com as telas do celular
 * (útil para testar no navegador exatamente o que roda no Android).
 * Sem a variável, o navegador recebe a plataforma web completa.
 */
export const MOBILE_WEB = process.env.EXPO_PUBLIC_WEB_LAYOUT === 'mobile';
