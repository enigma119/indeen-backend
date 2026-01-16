# Indeen - Islamic Mentorship Platform

Backend API for Indeen, an Islamic mentorship platform connecting Quran teachers (mentors) with students (mentees).

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma 7
- **Authentication**: Supabase Auth + JWT
- **Documentation**: Swagger/OpenAPI

## Features

### Authentication & Users
- Supabase JWT token validation
- Role-based access control (MENTOR, MENTEE, PARENT, ADMIN)
- User profile management
- Account activation/deactivation

### Mentors
- Complete mentor profile CRUD
- Advanced search with filters (languages, specialties, price, rating, etc.)
- Verification status management (PENDING, APPROVED, REJECTED)
- Mentor statistics (sessions, ratings, students)

### Mentees
- Mentee profile management
- Learning progress tracking
- Parental consent flow for minors
- Learning goals and preferences

### Availability
- Mentor availability slots management
- Weekly recurring availability patterns
- Available slots calculation for booking
- Conflict detection with existing sessions

### Matching
- Compatibility algorithm (0-100 score)
- Weighted scoring system:
  - Learner Category: 100 pts (CRITICAL)
  - Accepted Level: 80 pts (HIGH)
  - Languages: 80 pts (HIGH)
  - Learning Context: 50 pts (MEDIUM)
  - Budget: 40 pts (MEDIUM)
  - Timezone: 30 pts (LOW)
  - Rating: 20 pts (LOW)
- Mentor recommendations for mentees

## Project Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Environment
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (if using Prisma migrations)
npx prisma migrate dev
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

Swagger documentation available at `/api/docs` when running the application.

### Main Endpoints

#### Authentication
- `POST /auth/login` - Login with Supabase token
- `POST /auth/register` - Register new user
- `GET /auth/me` - Get current user

#### Users
- `GET /users/me` - Get my profile
- `PATCH /users/me` - Update my profile
- `DELETE /users/me` - Deactivate account

#### Mentors
- `POST /mentors` - Create mentor profile
- `GET /mentors` - List mentors (public)
- `GET /mentors/search` - Advanced search
- `GET /mentors/:id` - Get mentor details
- `GET /mentors/me` - Get my mentor profile
- `PATCH /mentors/me` - Update my mentor profile
- `GET /mentors/:id/stats` - Get mentor statistics

#### Mentees
- `POST /mentees` - Create mentee profile
- `GET /mentees/me` - Get my mentee profile
- `PATCH /mentees/me` - Update my mentee profile
- `GET /mentees/:id/consent` - Check parental consent
- `POST /mentees/:id/consent` - Grant parental consent

#### Availability
- `POST /mentors/:id/availability` - Add availability slot
- `GET /mentors/:id/availability` - List availability
- `GET /mentors/:id/available-slots` - Get free slots for date
- `POST /mentors/:id/availability/bulk` - Bulk create weekly pattern
- `PATCH /availability/:id` - Update slot
- `DELETE /availability/:id` - Delete slot

#### Matching
- `POST /matching/find-mentors` - Find compatible mentors
- `GET /matching/recommendations/:menteeId` - Get recommendations
- `GET /matching/compatibility/:mentorId/:menteeId` - Get compatibility score

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test -- --testPathPatterns="mentors"
```

## Project Structure

```
src/
├── auth/                 # Authentication module
├── availability/         # Mentor availability management
├── common/
│   ├── decorators/       # Custom decorators (@Public, @Roles, etc.)
│   ├── filters/          # Exception filters
│   └── guards/           # Auth guards (JWT, Roles, IsActive)
├── config/               # Configuration and validation
├── matching/             # Mentor-mentee matching algorithm
├── mentees/              # Mentee profiles module
├── mentors/              # Mentor profiles module
├── prisma/               # Prisma service
├── supabase/             # Supabase service
└── users/                # User management module
```

## Business Rules

### Mentors
- One mentor profile per MENTOR user
- `verification_status = PENDING` by default
- Only APPROVED mentors visible publicly
- `hourly_rate` required unless `free_sessions_only = true`

### Mentees
- One mentee profile per MENTEE user
- `parent_user_id` required for minors (CHILD/TEENAGER)
- Parental consent required before booking sessions

### Availability
- No overlapping availability slots
- `start_time < end_time` required
- `day_of_week` between 0 (Sunday) and 6 (Saturday)

### Matching
- Only suggest APPROVED mentors
- Respect `is_accepting_students` flag
- Filter out very poor matches (score < 20)

## License

MIT
