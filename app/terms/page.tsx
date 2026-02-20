'use client';

export default function TermsPage() {
    return (
        <div className="container mx-auto max-w-4xl px-4 py-12">
            <h1 className="text-4xl font-bold mb-8">Terms and Conditions</h1>
            
            <div className="prose prose-lg max-w-none space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
                    <p className="text-gray-700">
                        By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
                    <p className="text-gray-700">
                        Permission is granted to temporarily download one copy of the materials (information or software) on our website for personal, non-commercial transitory viewing only.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">3. Disclaimer</h2>
                    <p className="text-gray-700">
                        The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">4. Limitations</h2>
                    <p className="text-gray-700">
                        In no event shall our company or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">5. Accuracy of Materials</h2>
                    <p className="text-gray-700">
                        The materials appearing on our website could include technical, typographical, or photographic errors. We do not warrant that any of the materials on our website are accurate, complete, or current.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">6. Modifications</h2>
                    <p className="text-gray-700">
                        We may revise these terms of service for our website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">7. Governing Law</h2>
                    <p className="text-gray-700">
                        These terms and conditions are governed by and construed in accordance with the laws of your jurisdiction, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
                    </p>
                </section>
            </div>
        </div>
    );
}