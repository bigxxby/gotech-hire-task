# GoTech Chat — Fix Write-up

## Security

### 1. MD5 replaced with bcrypt

**Location:** `backend/src/auth.service.ts:21-23`

**Problem:** Passwords were hashed with `crypto.createHash('md5')`. MD5 is cryptographically broken — it's fast to brute-force and vulnerable to rainbow table attacks.

**Fix:** Replaced with `bcryptjs` using salt rounds of 10. Bcrypt is designed for password hashing: it's slow by design, includes a per-hash salt, and is resistant to GPU-accelerated attacks.

**Files:** `backend/src/auth/auth.service.ts`, `backend/package.json`

---

### 2. Hardcoded JWT secret moved to environment variable

**Location:** `backend/src/auth.service.ts:8` (`const JWT_SECRET = 'supersecret'`) and `backend/src/chat.controller.ts:22` (`jwt.verify(token, 'supersecret')`)

**Problem:** The JWT signing secret was hardcoded as a string literal in two separate files. Anyone with access to the source code could forge valid tokens.

**Fix:** JWT secret is now read from `process.env.JWT_SECRET` via NestJS `ConfigService`. Single source of truth in `AuthService`, injected where needed. The secret is passed through `docker-compose.yml` and defined in `.env`.

**Files:** `backend/src/auth/auth.service.ts`, `backend/src/app.module.ts`, `docker-compose.yml`

---

### 3. User endpoint no longer exposes password hashes

**Location:** `backend/src/app.controller.ts:35-39`

**Problem:** `GET /users` returned all users with all fields, including password hashes. Any authenticated user could harvest credentials.

**Fix:** Two-layer protection:
1. Removed the `/users` endpoint entirely. Replaced with `GET /users/me` that returns only the current authenticated user's `{id, username, role}`.
2. Added `@Column({ select: false })` on the `password` field in the `User` entity — TypeORM will never include it in query results unless explicitly requested via `addSelect`.

**Files:** `backend/src/users/users.controller.ts`, `backend/src/users/users.service.ts`, `backend/src/entities/user.entity.ts`

---

### 4. WebSocket server-side authentication

**Location:** `backend/src/chat.gateway.ts:37-39`

**Problem:** The `sendMessage` handler trusted `userId` and `senderName` sent by the client. Any user could impersonate another by sending a different `userId`.

**Fix:** Added Socket.IO middleware (`server.use()`) in `onModuleInit` that:
- Extracts the JWT from `socket.handshake.auth.token`
- Verifies it via `AuthService.verifyToken()`
- Stores the decoded user in `socket.data.user`
- Rejects unauthenticated connections with an error before they complete

The `sendMessage` handler now reads `userId` and `username` exclusively from `client.data.user`.

**Files:** `backend/src/chat/chat.gateway.ts`

---

### 5. XSS vulnerability fixed

**Location:** `frontend/src/components/MessageItem.tsx:48`

**Problem:** Message content was rendered via `dangerouslySetInnerHTML={{ __html: message.content }}`, allowing arbitrary script injection through chat messages.

**Fix:** Replaced with `{message.content}` — React escapes all text content by default, so `<script>` tags are rendered as harmless text.

**Files:** `frontend/src/components/MessageItem.tsx`

---

## Architecture & Design

### 6. Feature module structure

**Location:** `backend/src/app.module.ts` (entire flat structure)

**Problem:** All controllers, services, gateways, and entity registrations were in a single `AppModule`. No separation of concerns at the module level.

**Fix:** Reorganized into three NestJS feature modules:
- `AuthModule` — authentication controller, service, JWT guard, DTOs
- `ChatModule` — rooms/messages controller, service, WebSocket gateway, DTOs
- `UsersModule` — user profile controller and service

Each module imports only the repositories it needs and exports services for cross-module use.

**Files:** `backend/src/auth/auth.module.ts`, `backend/src/chat/chat.module.ts`, `backend/src/users/users.module.ts`, `backend/src/app.module.ts`

---

### 7. Service separation of concerns

**Location:** `backend/src/chat.service.ts`

**Problem:** `ChatService` contained `userRepository` and user-related methods (`getUserById`, `getActiveUsers`) that don't belong in a chat domain service.

**Fix:** User-related logic moved to `UsersService`. `ChatService` now only works with `Room` and `Message` repositories. Dead code (`getActiveUsers`, commented-out authorization in `deleteMessage`) removed.

**Files:** `backend/src/chat/chat.service.ts`, `backend/src/users/users.service.ts`

---

### 8. Business logic moved out of controller

**Location:** `backend/src/app.controller.ts:19-21`

**Problem:** Username length validation (`if (username.length < 3)`) was done directly in the controller instead of the service layer.

**Fix:** Validation is now handled declaratively via `CreateUserDto` with `@MinLength(3)` and `@MaxLength(20)` decorators, enforced by NestJS `ValidationPipe`.

**Files:** `backend/src/auth/dto/create-user.dto.ts`, `backend/src/auth/auth.controller.ts`

---

### 9. DTOs enforced via ValidationPipe

**Location:** `backend/src/main.ts` (missing ValidationPipe), controllers using `body: any`

**Problem:** DTOs with `class-validator` decorators existed but were never applied. Controllers accepted raw `any` bodies, making validation decorators useless.

**Fix:** Added `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` in `main.ts`. All controller methods now use typed DTOs (`CreateUserDto`, `LoginDto`, `CreateRoomDto`) instead of `body: any`. The `whitelist: true` option strips unknown properties.

**Files:** `backend/src/main.ts`, all controllers

---

### 10. Prop drilling eliminated

**Location:** `frontend/src/components/ChatPage.tsx:208-240`

**Problem:** `token`, `socket`, and `apiUrl` were passed through `ChatPage → RoomList → (unused)` and `ChatPage → MessageItem → (unused)`. These components never used those props.

**Fix:** Removed unused props from `RoomList` and `MessageItem` interfaces. They now only receive the data they actually need (`rooms`/`onSelectRoom` and `message`/`isOwn` respectively).

**Files:** `frontend/src/components/RoomList.tsx`, `frontend/src/components/MessageItem.tsx`, `frontend/src/components/ChatPage.tsx`

---

## Performance

### 11. N+1 query eliminated with JOIN

**Location:** `backend/src/chat.service.ts:33-48`

**Problem:** `getMessages()` first fetched all messages, then ran a separate `findOne` query per message to get the username. For 100 messages, this meant 101 queries.

**Fix:** Used TypeORM's `relations: ['user']` option which generates a single `LEFT JOIN` query. The result is mapped to include `username` from the joined `User` entity.

**Files:** `backend/src/chat/chat.service.ts`, `backend/src/entities/message.entity.ts` (added `@ManyToOne` relations)

---

### 12. Database indexes added

**Location:** `backend/src/entities/message.entity.ts`, `backend/src/entities/user.entity.ts`

**Problem:** `room_id` and `user_id` columns in the `messages` table had no indexes. Every query filtering by room required a full table scan.

**Fix:** Added `@Index()` decorators on `roomId` and `userId` in `Message` entity, and on `username` in `User` entity. TypeORM's `synchronize: true` creates these indexes automatically.

**Files:** `backend/src/entities/message.entity.ts`, `backend/src/entities/user.entity.ts`

---

### 13. Message pagination

**Location:** `backend/src/chat.controller.ts:32-35`

**Problem:** `GET /chat/rooms/:roomId/messages` returned every message ever sent in a room. For active rooms, this would grow unbounded.

**Fix:** Added cursor-based pagination with `?limit=50&before=123` query parameters. The `limit` controls page size (default 50), and `before` allows fetching older messages by ID. The frontend passes `limit` on each request.

**Files:** `backend/src/chat/chat.controller.ts`, `backend/src/chat/chat.service.ts`, `frontend/src/components/ChatPage.tsx`

---

### 14. Incremental message updates instead of full re-fetch

**Location:** `frontend/src/components/ChatPage.tsx:57-62`

**Problem:** On every `newMessage` WebSocket event, the frontend called `fetchMessages(roomId)` which re-fetched ALL messages from the server via REST. This was wasteful and caused UI flicker.

**Fix:** The `newMessage` handler now appends the new message to the existing state: `setMessages(prev => [...prev, message])`. No additional HTTP request needed.

**Files:** `frontend/src/components/ChatPage.tsx`

---

### 15. Socket connection stabilized

**Location:** `frontend/src/App.tsx:18`

**Problem:** `const socket = io('http://localhost:3000')` was called inside the component body, creating a new WebSocket connection on every render.

**Fix:** Socket is now created inside a `useEffect` with `token` as dependency, stored in `useState`. It's created once when the user logs in and disconnected on logout or token change. The socket also passes the JWT via `auth: { token }` for server-side authentication.

**Files:** `frontend/src/App.tsx`

---

## Code Quality

### 16. Removed deprecated commented-out code

**Location:** `backend/src/auth.service.ts:17-19`

**Problem:** A commented-out bcrypt implementation sat alongside the active MD5 code, creating confusion about which hashing method was in use.

**Fix:** Removed commented-out code entirely. The new `auth.service.ts` uses bcrypt cleanly with no dead code.

**Files:** `backend/src/auth/auth.service.ts`

---

### 17. Removed console.log from production paths

**Location:** `auth.service.ts:26,40`, `chat.gateway.ts:21,26,33`, `main.ts:13`, `ChatPage.tsx:58`

**Problem:** Debug `console.log` statements were scattered through production code paths including authentication and message handling.

**Fix:** All `console.log` statements removed. NestJS's built-in logger handles application logging through the framework.

**Files:** All backend services, gateway, main.ts, ChatPage.tsx

---

### 18. Typed parameters and return values

**Location:** Throughout backend services and frontend components

**Problem:** `any` was used extensively for function parameters, return types, and state variables (`Promise<any>`, `body: any`, `useState<any[]>([])`).

**Fix:** Added proper types: `TokenPayload` interface for JWT payloads, typed return values on service methods, typed DTOs for request bodies, `Room[]` and `MessageData[]` for frontend state. Controllers use typed DTOs instead of `body: any`.

**Files:** All backend and frontend files

---

### 19. Magic strings and numbers extracted to constants

**Location:** `backend/src/chat.gateway.ts` (`'room_'` x3), `frontend/src/class-components/Header.class.tsx` (status `1`/`2`)

**Problem:** The string `'room_'` was duplicated three times in the gateway. Header used magic numbers `1` and `2` to represent connection status.

**Fix:** Extracted `const ROOM_PREFIX = 'room_'` in the gateway. Header now uses the `isConnected: boolean` prop directly instead of numeric status codes. Page size extracted as `const PAGE_SIZE = 50` / `const DEFAULT_PAGE_SIZE = 50`.

**Files:** `backend/src/chat/chat.gateway.ts`, `frontend/src/components/Header.tsx`, `backend/src/chat/chat.controller.ts`

---

### 20. Class component converted to functional

**Location:** `frontend/src/class-components/Header.class.tsx`

**Problem:** `Header` was the only class component in an otherwise fully functional React codebase. It used `componentDidUpdate` lifecycle method and internal state for something that could be a simple prop.

**Fix:** Rewritten as a functional component at `frontend/src/components/Header.tsx`. Uses `isConnected` prop directly. Removed the `class-components/` directory.

**Files:** `frontend/src/components/Header.tsx` (new), `frontend/src/class-components/Header.class.tsx` (deleted)

---

### 21. Consistent camelCase naming in Message entity

**Location:** `backend/src/entities/message.entity.ts`

**Problem:** `room_id` and `user_id` (snake_case) were mixed with `senderName` and `createdAt` (camelCase) in the same entity.

**Fix:** All TypeScript properties now use camelCase (`roomId`, `userId`, `senderName`). Database column names are preserved via `@Column({ name: 'room_id' })` to avoid schema migration issues.

**Files:** `backend/src/entities/message.entity.ts`

---

### 22. Stable React list keys

**Location:** `frontend/src/components/ChatPage.tsx:231`

**Problem:** `key={index}` was used for message list rendering. Array indexes as keys cause React to incorrectly reuse DOM elements when items are added, removed, or reordered.

**Fix:** Changed to `key={msg.id}` — each message has a stable, unique database ID.

**Files:** `frontend/src/components/ChatPage.tsx`

---

### 23. Socket listener cleanup

**Location:** `frontend/src/components/ChatPage.tsx:66-67`

**Problem:** The `useEffect` that registered `socket.on('newMessage', ...)` had no cleanup function. On re-renders, duplicate listeners accumulated, causing memory leaks and duplicate message handling.

**Fix:** Added proper cleanup: `return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('newMessage', onNewMessage); }`.

**Files:** `frontend/src/components/ChatPage.tsx`
