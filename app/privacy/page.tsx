export default function PrivacyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
            
            <div className="space-y-6 text-gray-700">
                <section>
                    <h2 className="text-2xl font-semibold mb-3">Introduction</h2>
                    <p>
                        We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">Information We Collect</h2>
                    <p>We may collect information about you in a variety of ways, including:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Information you voluntarily provide</li>
                        <li>Automatically collected information</li>
                        <li>Information from third parties</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">Use of Your Information</h2>
                    <p>
                        Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Improve our website</li>
                        <li>Process your transactions</li>
                        <li>Email you regarding updates or informational purposes</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">Disclosure of Your Information</h2>
                    <p>
                        We may share information we have collected about you in certain situations:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>By law or to protect our rights</li>
                        <li>To third-party service providers</li>
                        <li>With your consent</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">Security of Your Information</h2>
                    <p>
                        We use administrative, technical, and physical security measures to protect your personal information.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
                    <p>
                        If you have questions or comments about this Privacy Policy, please contact us at: support@societywarriors.com
                    </p>
                </section>
            </div>
        </div>
    );
}