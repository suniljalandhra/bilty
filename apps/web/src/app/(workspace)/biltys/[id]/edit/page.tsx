'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import type { BiltyRecord } from '@bilty/shared-types';
import { api, errorMessage } from '@/lib/api';
import { BiltyForm } from '@/components/bilty-form';
import { ErrorNotice, Loading } from '@/components/ui';
export default function EditBiltyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params),
    [record, setRecord] = useState<BiltyRecord | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<BiltyRecord>(`/biltys/${id}`)
      .then((value) => {
        if (active) setRecord(value);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [id]);
  return record ? (
    <BiltyForm key={record.id} record={record} />
  ) : error ? (
    <>
      <ErrorNotice message={error} />
      <Link href="/biltys">Back to bilty book</Link>
    </>
  ) : (
    <Loading text="Loading the complete document…" />
  );
}
