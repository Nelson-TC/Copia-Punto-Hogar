"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface CartItem { productId: string; qty: number }
interface CartContextValue {
	items: CartItem[];
	loading: boolean;
	refresh: () => Promise<void>;
	setQuantity: (productId: string, qty: number) => Promise<void>;
	remove: (productId: string) => Promise<void>;
	count: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
	const [items, setItems] = useState<CartItem[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch('/api/cart', { cache: 'no-store' });
			if (!res.ok) return;
			const data = await res.json();
			if (Array.isArray(data.items)) setItems(data.items.map((i: any) => ({ productId: i.productId, qty: i.qty })));
		} finally { setLoading(false); }
	}, []);

	useEffect(() => { load(); }, [load]);

	// Escuchar eventos globales de actualización del carrito (ej: después de crear una orden)
	useEffect(() => {
		function handler() { load(); }
		window.addEventListener('cart:updated', handler);
		return () => window.removeEventListener('cart:updated', handler);
	}, [load]);

	const setQuantity = useCallback(async (productId: string, qty: number) => {
		await fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, qty }) });
		window.dispatchEvent(new CustomEvent('cart:updated'));
		await load();
	}, [load]);

	const remove = useCallback(async (productId: string) => {
		await fetch('/api/cart', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) });
		window.dispatchEvent(new CustomEvent('cart:updated'));
		await load();
	}, [load]);

	const value: CartContextValue = {
		items,
		loading,
		refresh: load,
		setQuantity,
		remove,
		count: items.reduce((s, i) => s + i.qty, 0)
	};

	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
	const ctx = useContext(CartContext);
	if (!ctx) throw new Error('useCart must be used within CartProvider');
	return ctx;
}
