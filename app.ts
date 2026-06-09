import { loginApi, getStarPowerBalance, getUserProfile, type UserProfile } from './utils/api'
import { setToken, getToken, clearAuth } from './utils/request'
import { STORAGE, LOGIN_STATE } from './config'

App<IAppOption>({
  globalData: {
    userInfo: null as UserProfile | null,
    starPowerBalance: 0,
    isLoggedIn: false,
    loginState: LOGIN_STATE.PENDING as 'pending' | LOGIN_STATE.SUCCESS | LOGIN_STATE.FAILED,
    _pendingCategory: null as string | null,
  },

  // 登录 Promise，页面可以 await 它
  _loginPromise: null as Promise<boolean> | null,

  onLaunch() {
    this._loginPromise = this.doLogin()
  },

  /** 等待登录完成，页面在 onLoad 中调用 */
  waitForLogin(): Promise<boolean> {
    if (this._loginPromise) return this._loginPromise
    this._loginPromise = this.doLogin()
    return this._loginPromise
  },

  /** 执行登录（由 waitForLogin 调用或手动触发） */
  doLogin(): Promise<boolean> {
    return new Promise((resolve) => {
      // 已有 token，直接验证
      if (getToken()) {
        this.globalData.isLoggedIn = true
        this.globalData.loginState = LOGIN_STATE.SUCCESS
        this.refreshUserData()
        resolve(true)
        return
      }

      wx.login({
        success: (res) => {
          if (!res.code) {
            this.globalData.loginState = LOGIN_STATE.FAILED
            resolve(false)
            return
          }

          loginApi(res.code).then((data) => {
            setToken(data.token)
            wx.setStorageSync(STORAGE.REFRESH_TOKEN, data.refreshToken)
            wx.setStorageSync(STORAGE.USER_ID, data.userId)
            this.globalData.isLoggedIn = true
            this.globalData.loginState = LOGIN_STATE.SUCCESS
            this.refreshUserData()
            resolve(true)
          }).catch(() => {
            console.error('登录失败')
            this.globalData.loginState = LOGIN_STATE.FAILED
            resolve(false)
          })
        },
        fail: () => {
          this.globalData.loginState = LOGIN_STATE.FAILED
          resolve(false)
        },
      })
    })
  },

  /** 手动重试登录（用户点击登录按钮时调用） */
  retryLogin(): Promise<boolean> {
    clearAuth()
    this._loginPromise = null
    this.globalData.loginState = LOGIN_STATE.PENDING
    return this.waitForLogin()
  },

  refreshUserData() {
    getUserProfile().then((profile) => {
      this.globalData.userInfo = profile
    }).catch(() => {})

    getStarPowerBalance().then((res) => {
      this.globalData.starPowerBalance = res.balance
    }).catch(() => {})
  },
})
