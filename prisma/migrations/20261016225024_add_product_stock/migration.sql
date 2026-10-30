-- AlterTable: inventario por producto (RF10 / RNF08)
ALTER TABLE "public"."Product" ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;

-- Los productos que ya existían quedan con existencias para no bloquear la venta.
UPDATE "public"."Product" SET "stock" = 25;

-- El inventario nunca puede quedar negativo, aunque dos pedidos compitan por el mismo producto.
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_stock_non_negative" CHECK ("stock" >= 0);
