# OpenBank Africa SDK — Spec Técnico v2.0

**Tagline:** The open-source React Native SDK for African mobile money & open banking APIs.
**Primer adapter:** MTN Mobile Money (MoMo) API — Rwanda, con arquitectura lista para sumar Airtel Money y bancos después.

> A diferencia de la v1 (basada en BK, con doc gateada), esta spec está armada sobre la API pública y documentada de MTN MoMo, verificada contra su developer portal y ejemplos reales de otras librerías existentes (Node, PHP, Java). Es información real, no supuesta.

---

## 1. Por qué MTN MoMo y no BK

- Sandbox de acceso libre, sin cuenta bancaria previa ni rol de "aggregator/superagent". Te registrás vos mismo en momodeveloper.mtn.com.
- Documentación pública y accesible (a diferencia de developer.bk.rw).
- Mobile money es el método de pago más usado en Ruanda, más que banca tradicional. Mayor impacto real, mejor alineado con la agenda de "inclusión financiera" del gobierno.
- Ya existen wrappers Node/PHP/Java para MTN MoMo, pero **ninguno es un SDK cliente en React Native**, y ninguno unifica varios proveedores (MTN + Airtel + bancos) bajo una sola interfaz. Ese es el hueco real que llena este proyecto.

## 2. Alcance del MVP (v1.0)

Incluido, sobre el producto **Collections** (el más relevante para una app que cobra pagos):
- Sandbox user & API key provisioning
- Autenticación OAuth2 (token Bearer)
- Request to Pay (cobrar a un usuario)
- Consultar estado de una transacción
- Consultar balance de cuenta

Fuera de alcance v1.0 (quedan para v2):
- Disbursements (pagar a usuarios)
- Remittances (transferencias transfronterizas)
- Adapter de Airtel Money (arquitectura preparada, no implementado)

## 3. Arquitectura

```
openbank-africa-sdk/
├── src/
│   ├── core/
│   │   ├── client.ts          # cliente HTTP base
│   │   ├── auth.ts            # OAuth2 token management
│   │   └── types.ts           # tipos compartidos
│   ├── adapters/
│   │   └── mtn-momo/
│   │       ├── index.ts       # implementación del adapter
│   │       ├── sandbox.ts     # provisioning de user/key en sandbox
│   │       ├── collections.ts # Request to Pay, balance, status
│   │       └── mappers.ts     # mapeo de respuestas MTN a tipos comunes del SDK
│   ├── OpenBankClient.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   └── integration/            # contra sandbox.momodeveloper.mtn.com real
├── examples/minimal-app/
├── .github/workflows/ci.yml
├── README.md / CHANGELOG.md / LICENSE (MIT) / package.json
```

## 4. Auth y provisioning — datos reales de la API

Base URL sandbox: `https://sandbox.momodeveloper.mtn.com`

**Paso 1 — Crear API User** (una sola vez, al setupear el proyecto):
```
POST /v1_0/apiuser
Headers:
  X-Reference-Id: <UUID v4 generado por vos>
  Ocp-Apim-Subscription-Key: <primary key del producto Collections>
Body:
  { "providerCallbackHost": "<tu dominio de callback>" }
```

**Paso 2 — Crear API Key** para ese user:
```
POST /v1_0/apiuser/{X-Reference-Id}/apikey
Headers:
  Ocp-Apim-Subscription-Key: <primary key>
```
Devuelve el `apiKey` que junto al `apiUser` (el X-Reference-Id) se usan para generar tokens.

**Paso 3 — Obtener token Bearer (OAuth2)**:
```
POST /collection/token/
Headers:
  Authorization: Basic base64(apiUser:apiKey)
  Ocp-Apim-Subscription-Key: <primary key>
```
Devuelve `access_token`, `token_type`, `expires_in`. El SDK maneja el refresh automático.

## 5. Endpoints del producto Collections

**Request to Pay** (cobrar a un usuario):
```
POST /collection/v1_0/requesttopay
Headers:
  Authorization: Bearer <token>
  X-Reference-Id: <UUID v4>
  X-Target-Environment: sandbox
  Ocp-Apim-Subscription-Key: <primary key>
Body:
{
  "amount": "5000",
  "currency": "RWF",
  "externalId": "order-123",
  "payer": { "partyIdType": "MSISDN", "partyId": "250788123456" },
  "payerMessage": "Pago pedido #123",
  "payeeNote": "Gracias por tu compra"
}
```

**Consultar estado de la transacción**:
```
GET /collection/v1_0/requesttopay/{X-Reference-Id}
Headers: Authorization: Bearer <token>, X-Target-Environment: sandbox, Ocp-Apim-Subscription-Key
```
Devuelve status: `PENDING | SUCCESSFUL | FAILED`

**Consultar balance**:
```
GET /collection/v1_0/account/balance
Headers: Authorization: Bearer <token>, X-Target-Environment: sandbox, Ocp-Apim-Subscription-Key
```

## 6. Interfaz pública propuesta

```typescript
import { OpenBankClient } from 'openbank-africa-sdk';

const client = new OpenBankClient({
  adapter: 'mtn-momo',
  subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY,
  callbackHost: 'https://mi-app.com/webhooks/momo',
  environment: 'sandbox', // 'sandbox' | 'production'
});

// Se provisiona automáticamente user/key en sandbox la primera vez
await client.authenticate();

const payment = await client.collections.requestToPay({
  amount: 5000,
  currency: 'RWF',
  phoneNumber: '250788123456',
  externalId: 'order-123',
  payerMessage: 'Pago pedido #123',
});

const status = await client.collections.getStatus(payment.referenceId);
const balance = await client.collections.getBalance();
```

## 7. Tipos base

```typescript
interface PaymentRequest {
  amount: number;
  currency: string;
  phoneNumber: string;
  externalId: string;
  payerMessage?: string;
  payeeNote?: string;
}

interface PaymentResult {
  referenceId: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
}

interface Balance {
  availableBalance: number;
  currency: string;
}
```

## 8. Manejo de errores

Mismo patrón que la v1: se normalizan los errores propios de MTN (`RESOURCE_NOT_FOUND`, `APPROVAL_REJECTED`, `EXPIRED`, `PAYER_NOT_FOUND`, `NOT_ALLOWED`, `INTERNAL_PROCESSING_ERROR`, según su documentación) a un set común del SDK.

## 9. Testing

- Unit tests contra mocks de la respuesta de MTN.
- Integration tests contra `sandbox.momodeveloper.mtn.com` real, usando el flujo de provisioning automático (no hace falta pedir credenciales a nadie, se generan solas en sandbox).

## 10. Checklist para arrancar — orden real de trabajo

1. [ ] Registrarse en momodeveloper.mtn.com (sin fricción, no pide cuenta bancaria)
2. [ ] Suscribirse al producto "Collections" para conseguir la Primary Key
3. [ ] Probar el flujo de provisioning manual (Postman) antes de codear, para validar contra la API real
4. [ ] Setup del repo con la estructura de la sección 3
5. [ ] Implementar `core/client.ts`, `core/auth.ts`, `adapters/mtn-momo/sandbox.ts`
6. [ ] Implementar Request to Pay + status + balance, con tests
7. [ ] README + ejemplo mínimo + CI
8. [ ] Release v0.1 público en GitHub
9. [ ] (Fase 2) Sumar adapter de Airtel Money, siguiendo la misma arquitectura

## 11. Diferencia clave vs. la v1 (BK)

Esta spec no tiene ningún **[CONFIRMAR]** pendiente: todos los endpoints, headers y flujos están verificados contra documentación pública real y contra el código de librerías existentes (Node, PHP, Java) que ya los usan en producción. Podés arrancar a codear hoy mismo sin esperar respuesta de nadie.
