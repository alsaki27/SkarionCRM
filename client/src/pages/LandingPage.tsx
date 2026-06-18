import React, { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "../../api.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Card } from "../../components/ui/Card.tsx";
import { Badge } from "../../components/ui/Badge.tsx";
import {
  Menu,
  X,
  FileText,
  ShieldCheck,
  Users,
  Repeat,
  Receipt,
  Bot,
  ChevronRight,
  Play,
  Check,
  ArrowRight,
  Twitter,
  Linkedin,
  Github,
  Mail,
  TrendingUp,
  DollarSign,
  Activity,
  Lock,
} from "lucide-react";

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let startTime: number | null = null;
    let animFrame: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        animFrame = requestAnimationFrame(animate);
      }
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [isVisible, end, duration]);

  return { count, ref };
}

// Scroll animation hook
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

interface StatCounterProps {
  label: string;
  value: number;
  suffix: string;
  prefix: string;
  isDecimal?: boolean;
}

function StatCounter({ label, value, suffix, prefix, isDecimal }: StatCounterProps) {
  const { count, ref } = useAnimatedCounter(value);
  return (
    <div ref={ref} className="reveal text-center">
      <div className="text-3xl sm:text-4xl font-bold text-slate-900 mb-1">
        {prefix}
        {isDecimal ? count.toFixed(1) : count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm text-slate-500 font-medium">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useScrollReveal();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGetStarted = useCallback(() => {
    window.location.href = "/register";
  }, []);

  const handleEmailSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (email.trim()) {
        window.location.href = `/register?email=${encodeURIComponent(email)}`;
      }
    },
    [email]
  );

  const stats = [
    { label: "Trusted by 10,000+ businesses", value: 10000, suffix: "+", prefix: "" },
    { label: "$2B+ processed", value: 2, suffix: "B+", prefix: "$" },
    { label: "99.9% uptime", value: 99.9, suffix: "%", prefix: "", isDecimal: true },
    { label: "SOC 2 compliant", value: 100, suffix: "%", prefix: "" },
  ];

  const features = [
    {
      icon: FileText,
      title: "Invoicing & AR",
      description:
        "Create, send, and track professional invoices. Automate payment reminders and reconcile accounts receivable in real time.",
      color: "bg-blue-500/10 text-blue-400",
    },
    {
      icon: ShieldCheck,
      title: "Tax & Compliance",
      description:
        "Stay compliant with automated tax calculations, filing reminders, and audit-ready reports. Supports federal, state, and local rules.",
      color: "bg-emerald-500/10 text-emerald-400",
    },
    {
      icon: Users,
      title: "Payroll & W2",
      description:
        "Run payroll in minutes, generate W2s and 1099s, and handle direct deposits, benefits deductions, and tax withholdings automatically.",
      color: "bg-purple-500/10 text-purple-400",
    },
    {
      icon: Repeat,
      title: "Recurring Transactions",
      description:
        "Schedule and manage recurring invoices, payments, and subscriptions. Never miss a billing cycle or a vendor payment again.",
      color: "bg-amber-500/10 text-amber-400",
    },
    {
      icon: Receipt,
      title: "Expense Management",
      description:
        "Capture receipts, categorize expenses, set budgets, and enforce spending policies with automated approval workflows.",
      color: "bg-rose-500/10 text-rose-400",
    },
    {
      icon: Bot,
      title: "AI Assistant",
      description:
        "Get instant answers to financial questions, anomaly detection, cash flow forecasting, and smart recommendations powered by AI.",
      color: "bg-cyan-500/10 text-cyan-400",
    },
  ];

  const pricing = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      description: "For freelancers and solopreneurs just getting started.",
      features: [
        "Up to 5 invoices/month",
        "1 connected bank account",
        "Basic expense tracking",
        "Email support",
      ],
      cta: "Start Free",
      highlighted: false,
    },
    {
      name: "Starter",
      price: "$29",
      period: "/mo",
      description: "For growing small businesses with basic financial needs.",
      features: [
        "Unlimited invoices",
        "3 connected bank accounts",
        "Expense management",
        "Tax reporting",
        "Priority email support",
      ],
      cta: "Get Started",
      highlighted: false,
    },
    {
      name: "Professional",
      price: "$79",
      period: "/mo",
      description: "For established businesses that need full financial control.",
      features: [
        "Everything in Starter",
        "Payroll & W2 generation",
        "Recurring transactions",
        "Multi-user access (5)",
        "AI assistant",
        "Live chat support",
      ],
      cta: "Get Started",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "/mo",
      description: "For larger organizations with advanced compliance needs.",
      features: [
        "Everything in Professional",
        "Unlimited users",
        "Custom integrations",
        "Dedicated account manager",
        "SOC 2 & audit support",
        "SSO & advanced security",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  const testimonials = [
    {
      quote:
        "Skarion cut our invoicing time by 80% and gave us real-time visibility into cash flow. It's the financial backbone of our agency.",
      name: "Sarah Chen",
      role: "CFO",
      company: "Northlight Digital",
      initials: "SC",
    },
    {
      quote:
        "We evaluated 6 tools before choosing Skarion. The payroll automation and tax compliance features alone saved us 20 hours per month.",
      name: "Marcus Johnson",
      role: "Operations Director",
      company: "TerraScale Logistics",
      initials: "MJ",
    },
    {
      quote:
        "The AI assistant flagged a duplicate payment before it went out. That one catch paid for our annual subscription.",
      name: "Elena Rodriguez",
      role: "Controller",
      company: "Apex Health Systems",
      initials: "ER",
    },
  ];

  const footerLinks = [
    {
      title: "Product",
      links: ["Features", "Pricing", "Integrations", "Changelog", "Roadmap"],
    },
    {
      title: "Company",
      links: ["About", "Blog", "Careers", "Press", "Partners"],
    },
    {
      title: "Resources",
      links: ["Documentation", "Help Center", "Community", "API Reference", "Status"],
    },
    {
      title: "Legal",
      links: ["Privacy", "Terms", "Security", "Cookies", "Compliance"],
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* Inject reveal animation styles */}
      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal.animate-in {
          opacity: 1;
          transform: translateY(0);
        }
        .hero-float {
          animation: float 6s ease-in-out infinite;
        }
        .hero-float-delay {
          animation: float 6s ease-in-out 2s infinite;
        }
        .hero-float-delay-2 {
          animation: float 6s ease-in-out 4s infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }
      `}</style>

      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span
                className={`text-xl font-bold tracking-tight transition-colors ${
                  scrolled ? "text-slate-900" : "text-white"
                }`}
              >
                Skarion
              </span>
            </a>

            <div className="hidden md:flex items-center gap-8">
              {["Features", "Pricing", "Testimonials", "Docs"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className={`text-sm font-medium transition-colors hover:opacity-80 ${
                    scrolled ? "text-slate-600 hover:text-slate-900" : "text-white/80 hover:text-white"
                  }`}
                >
                  {item}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <a href="/login">
                <Button
                  variant="ghost"
                  className={`text-sm font-medium ${
                    scrolled ? "text-slate-600 hover:text-slate-900" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Log In
                </Button>
              </a>
              <a href="/register">
                <Button className="bg-white text-slate-900 hover:bg-slate-100 text-sm font-semibold px-4">
                  Get Started
                </Button>
              </a>
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className={`w-6 h-6 ${scrolled ? "text-slate-900" : "text-white"}`} />
              ) : (
                <Menu className={`w-6 h-6 ${scrolled ? "text-slate-900" : "text-white"}`} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 shadow-lg">
            <div className="px-4 py-4 space-y-3">
              {["Features", "Pricing", "Testimonials", "Docs"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="block text-slate-700 font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <a href="/login">
                  <Button variant="outline" className="w-full justify-center">
                    Log In
                  </Button>
                </a>
                <a href="/register">
                  <Button className="w-full justify-center">Get Started</Button>
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900"
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/30 via-transparent to-blue-900/30" />
        </div>

        {/* Floating cards */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="hero-float absolute top-[20%] left-[10%] w-56 h-36 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="h-2 w-20 bg-white/20 rounded" />
            </div>
            <div className="h-2 w-32 bg-white/10 rounded mb-2" />
            <div className="h-2 w-24 bg-white/10 rounded" />
          </div>

          <div className="hero-float-delay absolute top-[15%] right-[12%] w-52 h-32 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span className="text-white/60 text-xs font-medium">Invoice #2841</span>
            </div>
            <div className="text-white text-lg font-semibold mb-1">$12,450.00</div>
            <div className="text-emerald-400 text-xs">Paid • 2h ago</div>
          </div>

          <div className="hero-float-delay-2 absolute bottom-[25%] left-[15%] w-48 h-28 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-white/60 text-xs">AI Insight</span>
            </div>
            <div className="text-white/90 text-xs leading-relaxed">
              Cash flow trending 18% above forecast for Q3.
            </div>
          </div>

          <div className="hero-float absolute bottom-[20%] right-[10%] w-44 h-24 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span className="text-white/60 text-xs">SOC 2</span>
            </div>
            <div className="text-white/90 text-xs">Audit passed with zero exceptions.</div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
          <div className="reveal">
            <Badge className="mb-6 bg-white/10 text-white/90 border-white/20 hover:bg-white/15 px-4 py-1.5 text-xs font-medium">
              Now with AI-powered financial insights
            </Badge>
          </div>

          <h1 className="reveal text-4xl sm:text-5xl lg:text-7xl font-bold text-white tracking-tight leading-tight mb-6">
            Skarion — The All-in-One
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Financial Command Center
            </span>
          </h1>

          <p className="reveal text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-4 leading-relaxed">
            Invoices, taxes, compliance, payroll, and AI-powered insights — all in one place. Built for
            SMBs and accountants who need clarity, speed, and control.
          </p>

          <p className="reveal text-sm text-slate-400 mb-10 max-w-xl mx-auto">
            Replace your scattered spreadsheets and manual processes with a unified platform that
            automates the busywork and surfaces what matters.
          </p>

          <div className="reveal flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold px-8 h-12 text-base shadow-lg shadow-white/10"
              onClick={handleGetStarted}
            >
              Get Started Free
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 font-semibold px-8 h-12 text-base"
            >
              <Play className="w-4 h-4 mr-2" />
              Watch Demo
            </Button>
          </div>

          {/* Hero visual / dashboard mockup */}
          <div className="reveal relative mx-auto max-w-4xl">
            <div className="rounded-xl border border-white/10 bg-slate-800/50 backdrop-blur-sm shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-slate-900/50">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <div className="ml-4 h-2 w-32 bg-white/10 rounded" />
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="h-2 w-16 bg-white/10 rounded" />
                  <div className="h-8 w-24 bg-white/20 rounded" />
                  <div className="h-2 w-20 bg-emerald-500/30 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-16 bg-white/10 rounded" />
                  <div className="h-8 w-24 bg-white/20 rounded" />
                  <div className="h-2 w-20 bg-white/10 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-16 bg-white/10 rounded" />
                  <div className="h-8 w-24 bg-white/20 rounded" />
                  <div className="h-2 w-20 bg-amber-500/30 rounded" />
                </div>
                <div className="col-span-3 h-32 bg-white/5 rounded border border-white/5 mt-2" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map((stat) => (
              <StatCounter
                key={stat.label}
                label={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                prefix={stat.prefix}
                isDecimal={stat.isDecimal}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="reveal text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything you need to run your finances
            </h2>
            <p className="reveal text-lg text-slate-500">
              Powerful modules that work together seamlessly. No more patchwork of disconnected tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="reveal group p-6 lg:p-8 border border-slate-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 bg-white"
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-5 transition-transform group-hover:scale-110`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="reveal text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="reveal text-lg text-slate-500">
              Start free, upgrade as you grow. No hidden fees, no surprises.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {pricing.map((tier) => (
              <div
                key={tier.name}
                className={`reveal relative flex flex-col rounded-2xl border p-6 lg:p-8 transition-all duration-300 ${
                  tier.highlighted
                    ? "border-indigo-500 bg-white shadow-xl shadow-indigo-500/10 scale-105 z-10"
                    : "border-slate-200 bg-white hover:shadow-lg hover:border-slate-300"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-indigo-600 text-white border-0 px-3 py-1 text-xs font-semibold">
                      Recommended
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">{tier.name}</h3>
                  <p className="text-sm text-slate-500 min-h-[40px]">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                  <span className="text-slate-500 text-sm">{tier.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full justify-center ${
                    tier.highlighted
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                  onClick={handleGetStarted}
                >
                  {tier.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="reveal text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Trusted by finance teams everywhere
            </h2>
            <p className="reveal text-lg text-slate-500">
              See why thousands of businesses choose Skarion to manage their financial operations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((t) => (
              <Card
                key={t.name}
                className="reveal p-6 lg:p-8 border border-slate-200 bg-slate-50/50"
              >
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                      key={s}
                      className="w-4 h-4 text-amber-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-slate-700 text-sm leading-relaxed mb-6">
                  "{t.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">
                      {t.role}, {t.company}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900" />
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/20 via-transparent to-blue-900/20" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="reveal text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Ready to take control of your finances?
          </h2>
          <p className="reveal text-lg text-slate-300 mb-10 max-w-xl mx-auto">
            Join 10,000+ businesses already using Skarion. Get started in minutes, no credit card
            required.
          </p>

          <form
            onSubmit={handleEmailSubmit}
            className="reveal flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email"
              className="flex-1 h-12 px-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required
            />
            <Button
              type="submit"
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold px-6 h-12 shadow-lg shadow-white/10"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <p className="reveal text-xs text-slate-500 mt-4">
            Free 14-day trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
            <div className="col-span-2 md:col-span-1">
              <a href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-xl font-bold text-white tracking-tight">Skarion</span>
              </a>
              <p className="text-sm text-slate-400 leading-relaxed">
                The all-in-one financial command center for modern businesses.
              </p>
            </div>

            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="text-sm font-semibold text-white mb-4">{group.title}</h4>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Skarion, Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
