import { permanentRedirect } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function MenuRedirect({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table: tableId } = await searchParams;

  permanentRedirect(`/${slug}${tableId ? `?table=${tableId}` : ''}`);
}
