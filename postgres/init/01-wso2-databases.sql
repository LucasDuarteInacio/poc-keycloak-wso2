-- Bancos de dados necessários para o WSO2 API Manager 4.5.0
-- Executado automaticamente pelo PostgreSQL na primeira inicialização do container

\c postgres

CREATE DATABASE "WSO2AM_DB"     OWNER postgres;
CREATE DATABASE "WSO2SHARED_DB" OWNER postgres;
CREATE DATABASE "WSO2CARBON_DB" OWNER postgres;
