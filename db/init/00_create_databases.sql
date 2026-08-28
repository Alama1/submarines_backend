-- Runs once on fresh Postgres volume via docker-entrypoint-initdb.d
-- ff14_db: Core database for BaseMaterials, SubmarineParts, PartMaterials, Orders, OrderItems, BulkDiscounts
-- ff14_gateway: Auth database for ApiKeys
CREATE DATABASE ff14_db;
CREATE DATABASE ff14_gateway;

