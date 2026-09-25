// The toys in this project, in picker order. To add one, make a folder
// src/toys/<id>/ with an index.js that default-exports defineToy({...}) (copy
// src/toys/example/), then add a line here.
//
// `name` is repeated here so the picker can list every toy without loading
// them all; test/toys.test.js checks it matches the toy's own name.

export const TOYS = [
  { id: 'example', name: 'EXAMPLE', load: () => import('./example/index.js') },
  { id: 'pulse', name: 'PULSE', load: () => import('./pulse/index.js') },
];

/** Load a toy's definition by id. */
export async function loadToy(id) {
  const entry = TOYS.find((t) => t.id === id);
  if (!entry) throw new Error(`No toy "${id}". Known: ${TOYS.map((t) => t.id).join(', ')}`);
  return (await entry.load()).default;
}
