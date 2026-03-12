# Postman Testing Guide for Solana Token Launchpad

Use these example requests to test your API with Postman. Replace `<token>` with your JWT from login/register responses.

---

## 1. Register a user
**POST** `/api/auth/register`
```json
{
  "email": "alice@example.com",
  "password": "password123",
  "name": "Alice"
}
```

---

## 2. Login
**POST** `/api/auth/login`
```json
{
  "email": "alice@example.com",
  "password": "password123"
}
```

---

## 3. Create a launch
**POST** `/api/launches`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "name": "Test Launch",
  "symbol": "TST",
  "totalSupply": 1000,
  "pricePerToken": 1,
  "startsAt": "2026-03-12T00:00:00.000Z",
  "endsAt": "2026-04-12T00:00:00.000Z",
  "maxPerWallet": 100,
  "description": "A test launch",
  "tiers": [
    { "minAmount": 0, "maxAmount": 100, "pricePerToken": 0.5 },
    { "minAmount": 100, "maxAmount": 500, "pricePerToken": 0.8 }
  ],
  "vesting": { "cliffDays": 10, "vestingDays": 30, "tgePercent": 10 }
}
```

---

## 4. Add whitelist addresses
**POST** `/api/launches/1/whitelist`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "addresses": ["wallet1", "wallet2"]
}
```

---

## 5. Create a referral code
**POST** `/api/launches/1/referrals`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "code": "REF10",
  "discountPercent": 10,
  "maxUses": 5
}
```

---

## 6. Purchase tokens
**POST** `/api/launches/1/purchase`
**Headers:** `Authorization: Bearer <token>`
```json
{
  "walletAddress": "wallet1",
  "amount": 50,
  "txSignature": "tx1",
  "referralCode": "REF10"
}
```

---

## 7. Get vesting schedule
**GET** `/api/launches/1/vesting?walletAddress=wallet1`

---

Repeat similar requests for other endpoints as needed. Always use the JWT token in the `Authorization` header for protected routes!