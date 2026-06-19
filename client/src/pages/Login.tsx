import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '../api.ts';
import { useAuthStore } from '../store.ts';
import { Button } from '../components/ui/Button.tsx';
import { Loading } from '../components/ui/Loading.tsx';
import { Mail, Lock, LayoutDashboard, Eye, EyeOff } from 'lucide-react';

export default function Login(): React.ReactElement {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('skarion_token', data.token);
      setAuth(data.user, data.token);
      navigate('/');
    },
    onError: (err) => {
      setFormError(err.message || 'Invalid email or password');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim() || !password.trim()) {
      setFormError('Please enter both email and password');
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-white">
            <LayoutDashboard size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Welcome to Skarion</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to your account to continue</p>
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input pl-10"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input pl-10 pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-600" />
                  Remember me
                </label>
                <button type="button" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loginMutation.isPending}
                className="w-full"
              >
                Sign in
              </Button>
            </form>
          </div>

          <div className="card-footer justify-center border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
