import { type AdminUser, loginRequestSchema } from '@xcel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Logo } from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { BRAND } from '../../config/brand';
import { apiPost } from '../../lib/api';
import { ME_KEY, requestErrors, useAdminMe } from '../api';
import { FormError, TextField } from '../components/fields';

/** Only same-site admin paths, so ?next= can never send someone elsewhere. */
function safeNext(next: string | null) {
  return next && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith('//') ? next : '/admin';
}

export function LoginPage() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const me = useAdminMe();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState(false);

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiPost<{ user: AdminUser }>('/admin/auth/login', body),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_KEY, user),
    onError: () => setPassword(''),
  });

  if (me.data) return <Navigate to={safeNext(params.get('next'))} replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginRequestSchema.safeParse({ email: email.trim(), password });
    setInvalid(!parsed.success);
    if (parsed.success) login.mutate(parsed.data);
  };

  return (
    <div className="flex min-h-screen flex-col bg-off-white">
      <title>{`Sign in – ${BRAND.name} admin`}</title>
      <meta name="robots" content="noindex, nofollow" />
      <header className="bg-blue-950 px-4 py-3">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <form
          onSubmit={submit}
          noValidate
          className="w-full max-w-sm space-y-5 rounded-lg border border-blue-100 bg-white p-6"
        >
          <h1 className="text-2xl font-bold">Admin sign in</h1>
          {params.has('next') && !login.error && (
            <p role="status">Sign in to continue. Your session may have ended.</p>
          )}
          <FormError
            message={
              invalid ? 'Enter your email address and password.' : requestErrors(login.error)['']
            }
          />
          <TextField
            label="Email address"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={setEmail}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
          />
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </main>
    </div>
  );
}
