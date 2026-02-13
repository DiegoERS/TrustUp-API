# TrustUp API Roadmap

This document outlines the development roadmap for the TrustUp API backend, organized into 10 sequential phases. Each phase builds upon the previous one to create a complete BNPL (Buy Now, Pay Later) system integrated with Stellar blockchain.

## Overview

The TrustUp API provides the backend infrastructure for a decentralized BNPL platform. It handles user authentication, reputation management, loan processing, liquidity pool operations, and blockchain integration.

**Total Issues**: 26
**Completed**: 0/26
**In Progress**: 0/26
**Pending**: 26/26

---

## Phase 1: Wallet Authentication

**Goal**: Implement secure authentication using Stellar wallet signatures
**Dependencies**: None (Foundation)
**Status**: 🔴 Not Started

### Issues

#### API-01: Implement nonce endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Create endpoint to generate unique nonces for wallet authentication
- **Tasks**:
  - Generate cryptographically secure random nonce
  - Associate nonce with wallet address
  - Store nonce temporarily (5-10 minutes TTL)
  - Return nonce to client
- **Endpoint**: `POST /auth/nonce`
- **Response**: `{ nonce: string, expiresAt: timestamp }`

#### API-02: Implement signature verification
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Verify Stellar wallet signature and issue JWT tokens
- **Tasks**:
  - Verify Stellar signature against nonce
  - Validate signature timestamp
  - Generate JWT access token (15min expiry)
  - Generate JWT refresh token (7 days expiry)
  - Store refresh token in Supabase
  - Clear used nonce
- **Endpoint**: `POST /auth/verify`
- **Request**: `{ wallet: string, signature: string, nonce: string }`
- **Response**: `{ accessToken: string, refreshToken: string }`

#### API-03: Implement auth guard
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Protect authenticated endpoints with JWT validation
- **Tasks**:
  - Create NestJS auth guard
  - Validate JWT access token
  - Extract wallet address from token
  - Inject wallet into request context
  - Handle token expiration errors
- **Usage**: `@UseGuards(JwtAuthGuard)`

---

## Phase 2: User Profile

**Goal**: Enable users to view and update their profile information
**Dependencies**: Phase 1 (Authentication required)
**Status**: 🔴 Not Started

### Issues

#### API-04: Implement get user profile
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Retrieve authenticated user's profile from database
- **Tasks**:
  - Query Supabase `users` table by wallet
  - Return profile data (name, avatar, preferences)
  - Handle non-existent users (create default profile)
- **Endpoint**: `GET /users/me`
- **Response**: `{ wallet: string, name: string, avatar: string, preferences: object }`

#### API-05: Implement update user profile
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Allow users to update their profile information
- **Tasks**:
  - Validate input data (DTO validation)
  - Update Supabase `users` table
  - Sanitize user inputs
  - Return updated profile
- **Endpoint**: `PATCH /users/me`
- **Request**: `{ name?: string, avatar?: string, preferences?: object }`
- **Response**: Updated user profile

---

## Phase 3: Merchants

**Goal**: Provide merchant discovery and details
**Dependencies**: Phase 1 (Authentication required)
**Status**: 🔴 Not Started

### Issues

#### API-06: Implement merchants list endpoint
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: List all active merchants available for BNPL purchases
- **Tasks**:
  - Query Supabase `merchants` table
  - Filter by `is_active = true`
  - Support pagination (limit, offset)
  - Return merchant summaries
- **Endpoint**: `GET /merchants`
- **Query Params**: `?limit=20&offset=0`
- **Response**: `{ merchants: Array<MerchantSummary>, total: number }`

#### API-07: Implement merchant detail endpoint
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Get detailed information about a specific merchant
- **Tasks**:
  - Query merchant by ID or wallet address
  - Validate merchant exists
  - Return complete merchant metadata
- **Endpoint**: `GET /merchants/:id`
- **Response**: `MerchantDetail` object

---

## Phase 4: Reputation

**Goal**: Integrate with on-chain reputation contract
**Dependencies**: Phase 1, Reputation smart contract deployed
**Status**: 🔴 Not Started

### Issues

#### API-08: Implement reputation read service
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Query user reputation score from Soroban contract
- **Tasks**:
  - Initialize Stellar SDK Soroban client
  - Call `get_score()` on Reputation contract
  - Parse contract response (u32 score)
  - Normalize to 0-100 range
  - Handle contract errors gracefully
- **Endpoint**: `GET /reputation/:wallet`
- **Response**: `{ wallet: string, score: number, tier: string }`

#### API-09: Implement reputation cache
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Cache reputation scores for fast UX
- **Tasks**:
  - Implement Redis caching layer
  - Cache score with 5-minute TTL
  - Invalidate cache on reputation changes
  - Fallback to blockchain on cache miss
- **Cache Key**: `reputation:{wallet}`

---

## Phase 5: BNPL Loans

**Goal**: Core loan functionality - quote, create, repay, list
**Dependencies**: Phase 1, 3, 4 (Auth, Merchants, Reputation)
**Status**: 🔴 Not Started

### Issues

#### API-10: Implement loan quote endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Calculate loan terms based on reputation score
- **Tasks**:
  - Fetch user reputation score
  - Calculate interest rate from tier
  - Determine max credit limit
  - Generate repayment schedule
  - Return quote (no blockchain interaction)
- **Endpoint**: `POST /loans/quote`
- **Request**: `{ amount: number, merchant: string, term: number }`
- **Response**: `{ interestRate: number, totalRepayment: number, schedule: Array }`

#### API-11: Implement create loan endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Construct unsigned transaction for loan creation
- **Tasks**:
  - Validate merchant exists and is active
  - Verify user reputation meets minimum
  - Build `create_loan()` Soroban transaction
  - Set guarantee amount (20% of purchase)
  - Return unsigned XDR for user to sign
- **Endpoint**: `POST /loans/create`
- **Request**: `{ amount: number, merchant: string, guarantee: number }`
- **Response**: `{ xdr: string, loanId: string }`

#### API-12: Implement repay loan endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Construct unsigned transaction for loan repayment
- **Tasks**:
  - Validate loan exists and is active
  - Verify user owns the loan
  - Build `repay_loan()` Soroban transaction
  - Calculate remaining balance
  - Return unsigned XDR
- **Endpoint**: `POST /loans/:loanId/repay`
- **Request**: `{ amount: number }`
- **Response**: `{ xdr: string, remainingBalance: number }`

#### API-13: Implement list loans endpoint
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: List all loans for authenticated user
- **Tasks**:
  - Query indexed loans from Supabase
  - Optionally fetch latest state from blockchain
  - Filter by status (active, completed, defaulted)
  - Support pagination
- **Endpoint**: `GET /loans/me`
- **Query Params**: `?status=active&limit=20&offset=0`
- **Response**: `{ loans: Array<Loan>, total: number }`

---

## Phase 6: Transactions

**Goal**: Handle transaction submission and status tracking
**Dependencies**: Phase 5 (Requires loan transactions)
**Status**: 🔴 Not Started

### Issues

#### API-14: Implement submit transaction endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Submit signed XDR to Stellar network
- **Tasks**:
  - Receive signed XDR from client
  - Validate XDR format
  - Submit to Stellar via Horizon
  - Store transaction hash in Supabase
  - Return transaction hash and initial status
- **Endpoint**: `POST /transactions/submit`
- **Request**: `{ xdr: string }`
- **Response**: `{ hash: string, status: 'pending' }`

#### API-15: Implement transaction status endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Query transaction status from Stellar
- **Tasks**:
  - Query Horizon API by transaction hash
  - Parse transaction result
  - Normalize status (pending, success, failed)
  - Return detailed error on failure
- **Endpoint**: `GET /transactions/:hash`
- **Response**: `{ hash: string, status: string, result?: object, error?: string }`

---

## Phase 7: Liquidity Pool API

**Goal**: Enable liquidity provider operations
**Dependencies**: Phase 1, Liquidity Pool contract deployed
**Status**: 🔴 Not Started

### Issues

#### API-16: Implement pool overview endpoint
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Show liquidity pool metrics
- **Tasks**:
  - Query pool contract for total liquidity
  - Calculate current APY from recent interest
  - Get utilization rate (loaned / total)
  - Cache metrics with 1-minute TTL
- **Endpoint**: `GET /liquidity/overview`
- **Response**: `{ totalLiquidity: number, apy: number, utilization: number }`

#### API-17: Implement investor position endpoint
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Show LP's shares and returns
- **Tasks**:
  - Query LP shares from pool contract
  - Calculate current share value
  - Show deposited amount vs current value
  - Calculate unrealized gains
- **Endpoint**: `GET /liquidity/position`
- **Response**: `{ shares: number, value: number, deposited: number, gains: number }`

#### API-18: Implement deposit liquidity endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Construct deposit transaction
- **Tasks**:
  - Validate deposit amount
  - Build `deposit()` pool contract transaction
  - Calculate expected shares to receive
  - Return unsigned XDR
- **Endpoint**: `POST /liquidity/deposit`
- **Request**: `{ amount: number }`
- **Response**: `{ xdr: string, expectedShares: number }`

#### API-19: Implement withdraw liquidity endpoint
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Construct withdrawal transaction
- **Tasks**:
  - Validate user has shares
  - Check pool has available liquidity
  - Build `withdraw()` pool contract transaction
  - Calculate expected withdrawal amount
  - Return unsigned XDR
- **Endpoint**: `POST /liquidity/withdraw`
- **Request**: `{ shares: number }`
- **Response**: `{ xdr: string, expectedAmount: number }`

---

## Phase 8: Indexation & Background Jobs

**Goal**: Sync blockchain state with API database
**Dependencies**: Phases 5, 6 (Loans and Transactions)
**Status**: 🔴 Not Started

### Issues

#### API-20: Implement chain indexer job
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Background job to index blockchain events
- **Tasks**:
  - Poll Stellar for new contract events
  - Index loan creation events
  - Index repayment events
  - Index reputation changes
  - Update Supabase tables
  - Run every 30 seconds
- **Events Indexed**: `LOAN_CREATED`, `LOAN_REPAID`, `SCORE_CHANGED`

#### API-21: Implement transaction status job
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Update pending transaction statuses
- **Tasks**:
  - Query Supabase for pending transactions
  - Check Stellar status for each
  - Update to success/failed
  - Trigger follow-up actions (update loan status)
  - Run every 15 seconds
- **Cron**: `*/15 * * * * *`

#### API-22: Implement reminder job
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Detect loans approaching due date
- **Tasks**:
  - Query active loans from Supabase
  - Check next payment due date
  - Create notification if due in 3 days
  - Create notification if due in 1 day
  - Create notification if overdue
  - Run daily at 9 AM UTC
- **Cron**: `0 9 * * *`

---

## Phase 9: Notifications

**Goal**: User notification system
**Dependencies**: Phase 8 (Notifications created by jobs)
**Status**: 🔴 Not Started

### Issues

#### API-23: Implement list notifications endpoint
- **Status**: 🔴 Pending
- **Priority**: Medium
- **Description**: Retrieve user notifications
- **Tasks**:
  - Query Supabase `notifications` table
  - Filter by user wallet
  - Support read/unread filter
  - Order by created date (newest first)
  - Support pagination
- **Endpoint**: `GET /notifications`
- **Query Params**: `?unread=true&limit=20&offset=0`
- **Response**: `{ notifications: Array<Notification>, unreadCount: number }`

#### API-24: Implement mark notification as read endpoint
- **Status**: 🔴 Pending
- **Priority**: Low
- **Description**: Mark notification(s) as read
- **Tasks**:
  - Validate notification belongs to user
  - Update `is_read = true` in Supabase
  - Support bulk mark as read
  - Return updated notification
- **Endpoint**: `PATCH /notifications/:id/read`
- **Endpoint**: `PATCH /notifications/read-all`
- **Response**: `{ success: boolean }`

---

## Phase 10: Quality Assurance

**Goal**: Comprehensive testing and validation
**Dependencies**: All phases
**Status**: 🔴 Not Started

### Issues

#### API-25: Add unit tests for core services
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: Unit test coverage for critical services
- **Scope**:
  - AuthService: nonce generation, signature verification
  - ReputationService: score fetching, caching
  - LoanService: quote calculation, transaction building
  - LiquidityService: deposit/withdrawal logic
- **Target**: 80%+ coverage for services

#### API-26: Add integration tests for BNPL flow
- **Status**: 🔴 Pending
- **Priority**: High
- **Description**: End-to-end testing of complete user journeys
- **Test Cases**:
  - Happy path: Auth → Quote → Create Loan → Repay → Complete
  - Reputation update flow
  - Default scenario
  - Liquidity provider deposit/withdraw
  - API ↔ Smart Contract integration
- **Target**: All critical flows tested

---

## Progress Tracking

### Phase Status Summary

| Phase | Name | Issues | Completed | Status |
|-------|------|--------|-----------|--------|
| 1 | Wallet Authentication | 3 | 0/3 | 🔴 Not Started |
| 2 | User Profile | 2 | 0/2 | 🔴 Not Started |
| 3 | Merchants | 2 | 0/2 | 🔴 Not Started |
| 4 | Reputation | 2 | 0/2 | 🔴 Not Started |
| 5 | BNPL Loans | 4 | 0/4 | 🔴 Not Started |
| 6 | Transactions | 2 | 0/2 | 🔴 Not Started |
| 7 | Liquidity Pool API | 4 | 0/4 | 🔴 Not Started |
| 8 | Indexation & Jobs | 3 | 0/3 | 🔴 Not Started |
| 9 | Notifications | 2 | 0/2 | 🔴 Not Started |
| 10 | Quality Assurance | 2 | 0/2 | 🔴 Not Started |

### Overall Progress: 0/26 (0%)

---

## Dependencies Graph

```
Phase 1 (Auth)
    ├─> Phase 2 (Profile)
    ├─> Phase 3 (Merchants)
    ├─> Phase 4 (Reputation)
    │       └─> Phase 5 (Loans)
    │               ├─> Phase 6 (Transactions)
    │               │       └─> Phase 8 (Indexer)
    │               │               └─> Phase 9 (Notifications)
    │               └─> Phase 7 (Liquidity)
    │                       └─> Phase 8 (Indexer)
    └─> Phase 10 (Testing) - Depends on all phases
```

---

## Next Steps

1. **Start with Phase 1**: Implement wallet-based authentication
2. **Setup Testing**: Configure Jest and create test utilities
3. **Deploy Contracts**: Ensure Reputation contract is on testnet
4. **Configure Supabase**: Create necessary tables and migrations
5. **Setup Redis**: For caching layer (Phase 4)

---

## Notes

- **Testnet First**: All development should be done on Stellar testnet
- **API Documentation**: Use Swagger/OpenAPI for endpoint documentation
- **Error Handling**: Follow error-handling.md standards
- **Security**: Never expose private keys, validate all inputs
- **Performance**: Cache blockchain reads when possible

---

## Related Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [Blockchain Layer](docs/architecture/blockchain-layer.md)
- [Development Standards](docs/development/)
- [Setup Guide](docs/setup/)

---

*Last Updated: 2026-02-13*
