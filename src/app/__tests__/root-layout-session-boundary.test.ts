import fs from 'node:fs';
import path from 'node:path';

describe('root layout session boundary', () => {
  it('does not make every route dynamic with a root getServerSession lookup', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(source).not.toContain('getServerSession');
    expect(source).not.toMatch(/export default async function RootLayout/);
    expect(source).toContain('<SessionProvider>');
    expect(source).toContain('<AIInterfaceWrapper />');
  });
});
