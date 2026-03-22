import { SignIn } from '@clerk/nextjs'
import { AuthFrame } from '@/components/auth/AuthFrame'

export default function SignInPage() {
  return (
    <AuthFrame title="PDF Lovers Admin" subtitle="Sign in to continue">
      <SignIn
        path="/sign-in"
        routing="path"
        appearance={{
          variables: {
            colorPrimary: '#ffffff',
            colorBackground: '#0e0e0e',
            colorInputBackground: 'rgba(255,255,255,0.05)',
            colorInputText: '#ffffff',
            colorText: '#cccccc',
            borderRadius: '10px',
          },
        }}
      />
    </AuthFrame>
  )
}
