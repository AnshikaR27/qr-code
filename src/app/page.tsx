import Link from 'next/link';
import { Button } from '@/components/ui/button';

const steps = [
  {
    number: '01',
    title: 'Sign up & add your menu',
    description: 'Create your restaurant profile and upload dishes manually or scan your existing paper menu with AI.',
  },
  {
    number: '02',
    title: 'Get your QR code',
    description: 'We generate a unique QR code for each table. Print and place them — done in under a minute.',
  },
  {
    number: '03',
    title: 'Customers order from their phones',
    description: 'Guests scan, browse, and place orders. You see them live in your kitchen dashboard.',
  },
];

const features = [
  { icon: '🤖', title: 'AI Menu Scanner', description: 'Photo your paper menu — our AI extracts every dish, price, and category automatically.' },
  { icon: '⚡', title: 'Live Kitchen Board', description: 'Orders appear instantly. Advance from Placed → Preparing → Ready with one tap.' },
  { icon: '🎨', title: 'Branded Menu', description: 'Upload your logo and we auto-extract your brand colours for a beautiful, on-brand menu.' },
  { icon: '📊', title: 'Daily Stats', description: 'Revenue, order count, top dish — everything you need at a glance on the dashboard.' },
  { icon: '🌐', title: 'Works on any phone', description: 'No app download needed. Customers open a link, that\'s it.' },
  { icon: '🔒', title: 'Secure & reliable', description: 'Built on Supabase — enterprise-grade Postgres with row-level security.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-black text-xl tracking-tight">
            Menu<span className="text-[#e94560]">QR</span>
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" className="bg-[#e94560] hover:bg-[#c73652] text-white" asChild>
              <Link href="/register">Get started free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-block bg-[#e94560]/10 text-[#e94560] text-sm font-semibold px-4 py-1.5 rounded-full">
            QR ordering for Indian restaurants
          </div>
          <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-tight">
            Turn your menu into a<br />
            <span className="text-[#e94560]">digital experience</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-xl mx-auto leading-relaxed">
            Upload your menu, get a QR code, and let customers order straight from their phones — in under 10 minutes.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Button size="lg" className="bg-[#e94560] hover:bg-[#c73652] text-white font-bold px-8 h-12" asChild>
              <Link href="/register">Create your menu — it&apos;s free</Link>
            </Button>
          </div>
          <p className="text-sm text-gray-400">No credit card required · Setup in 10 minutes</p>
        </div>

        {/* Mock UI preview */}
        <div className="mt-16 max-w-sm mx-auto">
          <div className="rounded-3xl border-4 border-gray-900 shadow-2xl overflow-hidden bg-gray-50">
            <div className="bg-gray-900 h-6 flex items-center justify-center gap-1">
              <div className="w-12 h-1.5 rounded-full bg-gray-600" />
            </div>
            <div className="bg-gradient-to-b from-[#e94560] to-[#c73652] p-5 text-white text-left">
              <div className="w-12 h-12 rounded-full bg-white/20 mb-3 flex items-center justify-center text-xl">🍽️</div>
              <div className="font-black text-xl">Sharma&apos;s Dhaba</div>
              <div className="text-white/70 text-sm">New Delhi · Open now</div>
            </div>
            <div className="p-4 space-y-3">
              {[
                { name: 'Paneer Butter Masala', price: '₹280', veg: true },
                { name: 'Dal Makhani', price: '₹220', veg: true },
                { name: 'Chicken Biryani', price: '₹350', veg: false },
              ].map((dish) => (
                <div key={dish.name} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${dish.veg ? 'border-green-600' : 'border-red-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${dish.veg ? 'bg-green-600' : 'bg-red-600'}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{dish.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#e94560]">{dish.price}</span>
                    <button className="w-6 h-6 rounded-full bg-[#e94560] text-white text-xs font-bold flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black">How it works</h2>
            <p className="text-gray-500 mt-3 text-lg">From signup to first order in minutes.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center space-y-3">
                <div className="text-5xl font-black text-[#e94560]/20">{step.number}</div>
                <h3 className="font-bold text-lg">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black">Everything you need</h2>
            <p className="text-gray-500 mt-3 text-lg">A complete ordering system for your restaurant.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-base mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-gray-900 text-white text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-4xl font-black">Ready to go digital?</h2>
          <p className="text-gray-400 text-lg">
            Join hundreds of restaurants already using MenuQR to take orders faster.
          </p>
          <Button size="lg" className="bg-[#e94560] hover:bg-[#c73652] text-white font-bold px-10 h-12" asChild>
            <Link href="/register">Create your free menu</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span className="font-black text-gray-900">
            Menu<span className="text-[#e94560]">QR</span>
          </span>
          <span>© {new Date().getFullYear()} MenuQR. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-gray-700">Log in</Link>
            <Link href="/register" className="hover:text-gray-700">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
