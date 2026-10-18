import { httpRouter } from 'convex/server'
import { authComponentClient, createAuth } from './auth'
import { preflight, upload } from './chat/upload'

const http = httpRouter()

authComponentClient.registerRoutes(http, createAuth)
http.route({ path: '/chat/upload', method: 'POST', handler: upload })
http.route({ path: '/chat/upload', method: 'OPTIONS', handler: preflight })

export default http
