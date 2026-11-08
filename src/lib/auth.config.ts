import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.employee = (user as any).employee
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as any
        session.user.employee = token.employee as any
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
