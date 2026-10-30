import '../globals.css';
import { ReactNode } from 'react';
import { AuthProvider } from '../components/AuthProvider';
import { CartProvider } from '../components/CartProvider';
import SiteShell from '../components/SiteShell';
import NextTopLoader from 'nextjs-toploader';

export const metadata = {
  title: 'Punto Hogar',
  description: 'Punto Hogar: tienda en línea de artículos para el hogar, ferretería, iluminación, jardín y productos de uso cotidiano.'
};

export const dynamic = 'force-dynamic';
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-surface-alt text-ink">
        <NextTopLoader color='#F58220' /> 
        <AuthProvider>
          <CartProvider>
            <SiteShell>{children}</SiteShell>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
