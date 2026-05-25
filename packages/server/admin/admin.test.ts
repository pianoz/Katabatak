import { describe, it, expect, beforeAll, vi } from 'vitest'
import express from 'express'
import supertest from 'supertest'

vi.stubEnv('ADMIN_USERNAME', 'testadmin')
vi.stubEnv('ADMIN_PASSWORD', 'testpass')
vi.stubEnv('SESSION_SECRET', 'test-session-secret-long-enough')
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')
vi.stubEnv('GM_API_KEY', 'test-gm-key')

const { adminRouter, sessionMiddleware } = await import('./routes.js')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(sessionMiddleware)
app.use('/admin', adminRouter)

const agent = supertest.agent(app)

describe('Admin routes', () => {
  describe('GET /admin/dashboard (unauthenticated)', () => {
    it('redirects to /admin/login', async () => {
      const res = await supertest(app).get('/admin/dashboard')
      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/admin/login')
    })
  })

  describe('GET /admin/login', () => {
    it('returns the login page HTML', async () => {
      const res = await supertest(app).get('/admin/login')
      expect(res.status).toBe(200)
      expect(res.text).toContain('GM Server')
      expect(res.text).toContain('<form')
    })
  })

  describe('POST /admin/login', () => {
    it('rejects wrong credentials with 401', async () => {
      const res = await supertest(app)
        .post('/admin/login')
        .send('username=wrong&password=wrong')
        .set('Content-Type', 'application/x-www-form-urlencoded')
      expect(res.status).toBe(401)
      expect(res.text).toContain('Invalid credentials')
    })

    it('accepts correct credentials and sets session', async () => {
      const res = await agent
        .post('/admin/login')
        .send('username=testadmin&password=testpass')
        .set('Content-Type', 'application/x-www-form-urlencoded')
      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/admin/dashboard')
    })
  })

  describe('GET /admin/dashboard (authenticated)', () => {
    it('returns the dashboard HTML after login', async () => {
      const res = await agent.get('/admin/dashboard')
      expect(res.status).toBe(200)
      expect(res.text).toContain('Dashboard')
    })
  })

  describe('GET /admin/health', () => {
    it('returns JSON health status', async () => {
      const res = await supertest(app).get('/admin/health')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ status: 'ok' })
      expect(typeof res.body.uptimeSec).toBe('number')
    })
  })

  describe('POST /admin/logout', () => {
    it('destroys session and redirects to login', async () => {
      const res = await agent.post('/admin/logout')
      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/admin/login')
    })

    it('dashboard redirects to login after logout', async () => {
      const res = await agent.get('/admin/dashboard')
      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/admin/login')
    })
  })
})
