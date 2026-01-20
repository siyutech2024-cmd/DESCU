import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const PrivacyPolicyPage: React.FC = () => {
    const navigate = useNavigate();
    const { language } = useLanguage();

    const content = language === 'zh' ? {
        title: '隐私政策',
        lastUpdated: '最后更新：2026年1月20日',
        back: '返回',
        sections: [
            {
                title: '1. 信息收集',
                content: `DESCU（"我们"）尊重您的隐私。本隐私政策说明我们如何收集、使用和保护您的个人信息。

我们收集以下类型的信息：
• **账户信息**：当您注册时，我们收集您的姓名、电子邮件地址和个人资料信息。
• **位置信息**：为了向您显示附近的商品，我们会请求访问您的位置。
• **相机和照片**：当您发布商品时，我们会请求访问您的相机和照片库以拍摄或上传商品图片。
• **使用数据**：我们收集有关您如何使用我们服务的信息。`
            },
            {
                title: '2. 信息使用',
                content: `我们使用收集的信息用于：
• 提供、维护和改进我们的服务
• 处理交易和发送相关通知
• 向您发送技术通知和支持消息
• 响应您的评论和问题
• 保护用户安全并防止欺诈
• 个性化和改善您的体验`
            },
            {
                title: '3. 信息共享',
                content: `我们不会出售您的个人信息。我们仅在以下情况下共享您的信息：
• **与其他用户**：当您发布商品时，其他用户可以看到您的公开个人资料信息。
• **服务提供商**：我们与帮助我们运营服务的第三方合作（如支付处理、云存储）。
• **法律要求**：如果法律要求或为保护我们的权利，我们可能会披露信息。`
            },
            {
                title: '4. 数据安全',
                content: `我们采取合理的技术和组织措施来保护您的个人信息：
• 使用SSL/TLS加密传输数据
• 安全存储敏感信息
• 限制对个人信息的访问
• 定期审查和更新安全实践`
            },
            {
                title: '5. 您的权利',
                content: `您有权：
• 访问和更新您的个人信息
• 删除您的账户和相关数据
• 选择退出营销通信
• 请求导出您的数据

如需行使这些权利，请通过应用内的设置或联系我们的支持团队。`
            },
            {
                title: '6. Cookie 和跟踪',
                content: `我们使用Cookie和类似技术来：
• 保持您的登录状态
• 记住您的偏好设置
• 分析使用模式以改进服务
• 提供个性化体验

您可以通过浏览器设置控制Cookie的使用。`
            },
            {
                title: '7. 儿童隐私',
                content: `我们的服务不面向13岁以下的儿童。我们不会故意收集13岁以下儿童的个人信息。如果我们发现收集了此类信息，将立即删除。`
            },
            {
                title: '8. 政策更新',
                content: `我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，并在重大变更时通知您。继续使用我们的服务即表示您接受更新后的政策。`
            },
            {
                title: '9. 联系我们',
                content: `如果您对本隐私政策有任何疑问，请联系我们：
• 电子邮件：privacy@descu.app
• 通过应用内的"帮助与反馈"功能`
            }
        ]
    } : {
        title: 'Privacy Policy',
        lastUpdated: 'Last Updated: January 20, 2026',
        back: 'Back',
        sections: [
            {
                title: '1. Information We Collect',
                content: `DESCU ("we", "us", or "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect your personal information.

We collect the following types of information:
• **Account Information**: When you register, we collect your name, email address, and profile information.
• **Location Information**: To show you nearby products, we request access to your location.
• **Camera and Photos**: When you post products, we request access to your camera and photo library to take or upload product images.
• **Usage Data**: We collect information about how you use our services.`
            },
            {
                title: '2. How We Use Information',
                content: `We use the information we collect to:
• Provide, maintain, and improve our services
• Process transactions and send related notifications
• Send you technical notices and support messages
• Respond to your comments and questions
• Protect user safety and prevent fraud
• Personalize and improve your experience`
            },
            {
                title: '3. Information Sharing',
                content: `We do not sell your personal information. We only share your information in the following circumstances:
• **With Other Users**: When you post products, other users can see your public profile information.
• **Service Providers**: We work with third parties who help us operate our services (such as payment processing, cloud storage).
• **Legal Requirements**: We may disclose information if required by law or to protect our rights.`
            },
            {
                title: '4. Data Security',
                content: `We implement reasonable technical and organizational measures to protect your personal information:
• Use SSL/TLS encryption for data transmission
• Secure storage of sensitive information
• Restricted access to personal information
• Regular review and updating of security practices`
            },
            {
                title: '5. Your Rights',
                content: `You have the right to:
• Access and update your personal information
• Delete your account and associated data
• Opt out of marketing communications
• Request export of your data

To exercise these rights, please use the settings in the app or contact our support team.`
            },
            {
                title: '6. Cookies and Tracking',
                content: `We use cookies and similar technologies to:
• Keep you logged in
• Remember your preferences
• Analyze usage patterns to improve our services
• Provide personalized experience

You can control cookie usage through your browser settings.`
            },
            {
                title: '7. Children\'s Privacy',
                content: `Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13. If we discover that we have collected such information, we will promptly delete it.`
            },
            {
                title: '8. Policy Updates',
                content: `We may update this Privacy Policy from time to time. Updated policies will be posted on this page, and we will notify you of significant changes. Continued use of our services constitutes acceptance of the updated policy.`
            },
            {
                title: '9. Contact Us',
                content: `If you have any questions about this Privacy Policy, please contact us:
• Email: privacy@descu.app
• Through the "Help & Feedback" feature in the app`
            }
        ]
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50">
            <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        {content.back}
                    </button>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                        {content.title}
                    </h1>
                    <p className="text-gray-500 text-sm">{content.lastUpdated}</p>
                </div>

                {/* Content */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 sm:p-8 space-y-8">
                    {content.sections.map((section, index) => (
                        <section key={index}>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">
                                {section.title}
                            </h2>
                            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                                {section.content}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>© 2026 DESCU. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;
