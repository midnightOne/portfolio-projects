import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestSimpleHomepagePage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle>Homepage Configuration Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is a simple test to verify the basic components are working.</p>
          <p>If you can see this, the basic UI components are functional.</p>
        </CardContent>
      </Card>
    </div>
  );
}