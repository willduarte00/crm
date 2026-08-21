/**
 * Pilha de diálogos abertos.
 *
 * Uma confirmação pode abrir por cima de um modal (ex.: excluir um contrato
 * de dentro da ficha do cliente). Sem uma pilha, o Esc fecharia os dois ao
 * mesmo tempo — `stopPropagation` não resolve, porque os dois ouvintes estão
 * no mesmo nó (`document`). Só o diálogo do topo reage ao Esc.
 */
const stack: symbol[] = [];

export function pushDialog(id: symbol): void {
  if (!stack.includes(id)) stack.push(id);
}

export function popDialog(id: symbol): void {
  const index = stack.indexOf(id);
  if (index !== -1) stack.splice(index, 1);
}

export function isTopDialog(id: symbol): boolean {
  return stack[stack.length - 1] === id;
}
