/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `npm run dev` y `npm run build` usan carpetas distintas. Si comparten `.next`, ejecutar un build (o borrar la carpeta)
  // mientras el servidor de desarrollo está activo deja la página sin estilos hasta reiniciar.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
};
export default nextConfig;
