-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- El costo nunca puede ser negativo (0 significa "costo aún no registrado").
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_costPrice_non_negative" CHECK ("costPrice" >= 0);
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_unitCost_non_negative" CHECK ("unitCost" >= 0);
