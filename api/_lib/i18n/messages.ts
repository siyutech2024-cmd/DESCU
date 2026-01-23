// Backend error messages in multiple languages
// Used by server controllers to return localized error messages

export type SupportedLanguage = 'zh' | 'en' | 'es';

export const errorMessages: Record<SupportedLanguage, Record<string, string>> = {
    zh: {
        // Authentication & Authorization
        UNAUTHORIZED: '未授权访问',
        FORBIDDEN: '禁止访问',
        PLEASE_LOGIN: '请先登录',

        // Validation
        MISSING_FIELDS: '缺少必要字段',
        INVALID_DATA: '数据格式无效',
        INVALID_USER_IDS: '无效的用户ID',
        INVALID_RESPONSE_TYPE: '无效的响应类型',
        INVALID_NEGOTIATION_FORMAT: '无效的议价消息格式',

        // Resources
        PRODUCT_NOT_FOUND: '商品未找到',
        USER_NOT_FOUND: '用户未找到',
        MESSAGE_NOT_FOUND: '消息不存在',
        CONVERSATION_NOT_FOUND: '会话不存在',
        SELLER_ACCOUNT_NOT_FOUND: '卖家账户未找到',

        // Product & Image
        IMAGE_REQUIRED: '需要上传图片',
        TITLE_PRICE_REQUIRED: '标题和价格为必填项',

        // Payment
        TOKEN_REQUIRED: '需要提供令牌',
        CREATE_ACCOUNT_FIRST: '请先创建卖家账户',

        // Business Logic
        CANNOT_OFFER_OWN_PRODUCT: '卖家不能对自己的产品议价',
        ONLY_SELLER_CAN_RESPOND: '只有卖家可以响应议价',
        MESSAGE_TEXT_REQUIRED: '消息内容不能为空',

        // Generic
        SERVER_ERROR: '服务器错误',
        OPERATION_FAILED: '操作失败',
        FAILED_TO_CREATE_PRODUCT: '创建商品失败',
        FAILED_TO_CREATE_CONVERSATION: '创建会话失败',
        FAILED_TO_SEND_MESSAGE: '发送消息失败',
        FAILED_TO_FETCH_CONVERSATIONS: '获取会话列表失败',
        FAILED_TO_FETCH_MESSAGES: '获取消息失败',
        FAILED_TO_MARK_AS_READ: '标记已读失败',

        // AI Service
        GEMINI_NOT_CONFIGURED: 'Gemini API 未配置',
        FAILED_TO_ANALYZE_IMAGE: '图片分析失败',
    },

    en: {
        // Authentication & Authorization
        UNAUTHORIZED: 'Unauthorized',
        FORBIDDEN: 'Forbidden',
        PLEASE_LOGIN: 'Please log in first',

        // Validation
        MISSING_FIELDS: 'Missing required fields',
        INVALID_DATA: 'Invalid data format',
        INVALID_USER_IDS: 'Invalid user IDs',
        INVALID_RESPONSE_TYPE: 'Invalid response type',
        INVALID_NEGOTIATION_FORMAT: 'Invalid negotiation message format',

        // Resources
        PRODUCT_NOT_FOUND: 'Product not found',
        USER_NOT_FOUND: 'User not found',
        MESSAGE_NOT_FOUND: 'Message not found',
        CONVERSATION_NOT_FOUND: 'Conversation not found',
        SELLER_ACCOUNT_NOT_FOUND: 'Seller account not found',

        // Product & Image
        IMAGE_REQUIRED: 'Image data is required',
        TITLE_PRICE_REQUIRED: 'Title and price are required',

        // Payment
        TOKEN_REQUIRED: 'Token is required',
        CREATE_ACCOUNT_FIRST: 'Please create seller account first',

        // Business Logic
        CANNOT_OFFER_OWN_PRODUCT: 'Sellers cannot make offers on their own products',
        ONLY_SELLER_CAN_RESPOND: 'Only the seller can respond to offers',
        MESSAGE_TEXT_REQUIRED: 'Message text is required',

        // Generic
        SERVER_ERROR: 'Server error',
        OPERATION_FAILED: 'Operation failed',
        FAILED_TO_CREATE_PRODUCT: 'Failed to create product',
        FAILED_TO_CREATE_CONVERSATION: 'Failed to create conversation',
        FAILED_TO_SEND_MESSAGE: 'Failed to send message',
        FAILED_TO_FETCH_CONVERSATIONS: 'Failed to fetch conversations',
        FAILED_TO_FETCH_MESSAGES: 'Failed to fetch messages',
        FAILED_TO_MARK_AS_READ: 'Failed to mark messages as read',

        // AI Service
        GEMINI_NOT_CONFIGURED: 'Gemini API not configured',
        FAILED_TO_ANALYZE_IMAGE: 'Failed to analyze image',
    },

    es: {
        // Authentication & Authorization
        UNAUTHORIZED: 'No autorizado',
        FORBIDDEN: 'Prohibido',
        PLEASE_LOGIN: 'Por favor inicia sesión primero',

        // Validation
        MISSING_FIELDS: 'Faltan campos requeridos',
        INVALID_DATA: 'Formato de datos inválido',
        INVALID_USER_IDS: 'IDs de usuario inválidos',
        INVALID_RESPONSE_TYPE: 'Tipo de respuesta inválido',
        INVALID_NEGOTIATION_FORMAT: 'Formato de mensaje de oferta inválido',

        // Resources
        PRODUCT_NOT_FOUND: 'Producto no encontrado',
        USER_NOT_FOUND: 'Usuario no encontrado',
        MESSAGE_NOT_FOUND: 'Mensaje no encontrado',
        CONVERSATION_NOT_FOUND: 'Conversación no encontrada',
        SELLER_ACCOUNT_NOT_FOUND: 'Cuenta de vendedor no encontrada',

        // Product & Image
        IMAGE_REQUIRED: 'Se requieren datos de imagen',
        TITLE_PRICE_REQUIRED: 'El título y el precio son obligatorios',

        // Payment
        TOKEN_REQUIRED: 'Se requiere token',
        CREATE_ACCOUNT_FIRST: 'Por favor crea una cuenta de vendedor primero',

        // Business Logic
        CANNOT_OFFER_OWN_PRODUCT: 'Los vendedores no pueden ofertar en sus propios productos',
        ONLY_SELLER_CAN_RESPOND: 'Solo el vendedor puede responder a ofertas',
        MESSAGE_TEXT_REQUIRED: 'El texto del mensaje es obligatorio',

        // Generic
        SERVER_ERROR: 'Error del servidor',
        OPERATION_FAILED: 'Operación fallida',
        FAILED_TO_CREATE_PRODUCT: 'Error al crear producto',
        FAILED_TO_CREATE_CONVERSATION: 'Error al crear conversación',
        FAILED_TO_SEND_MESSAGE: 'Error al enviar mensaje',
        FAILED_TO_FETCH_CONVERSATIONS: 'Error al obtener conversaciones',
        FAILED_TO_FETCH_MESSAGES: 'Error al obtener mensajes',
        FAILED_TO_MARK_AS_READ: 'Error al marcar como leído',

        // AI Service
        GEMINI_NOT_CONFIGURED: 'API de Gemini no configurada',
        FAILED_TO_ANALYZE_IMAGE: 'Error al analizar imagen',
    }
};
