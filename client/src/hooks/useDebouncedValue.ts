import { useEffect, useState } from 'react';

/**
 * Atrasa a propagação de um valor até que ele pare de mudar.
 *
 * Usado nos campos de busca: sem isso, cada tecla digitada disparava uma
 * requisição à API e as respostas podiam chegar fora de ordem.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
