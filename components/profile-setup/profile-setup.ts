import { updateUserProfile, uploadAvatar, getUserProfile } from '../../utils/api'
import { MSG as M } from '../../config'

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    nickname: '',
    avatarUrl: '',
    avatarTempPath: '',
    submitting: false,
  },

  methods: {
    onChooseAvatar(e: any) {
      const avatarUrl = e.detail.avatarUrl
      this.setData({ avatarTempPath: avatarUrl, avatarUrl })
    },

    onNicknameInput(e: any) {
      this.setData({ nickname: e.detail.value })
    },

    // type="nickname" 选择微信昵称时可能只触发 change 不触发 input
    onNicknameChange(e: any) {
      this.setData({ nickname: e.detail.value })
    },

    // 失焦时兜底同步输入框值
    onNicknameBlur(e: any) {
      if (e.detail.value) {
        this.setData({ nickname: e.detail.value })
      }
    },

    async onSubmit() {
      const nickname = (this.data.nickname || '').trim()
      if (!nickname) {
        wx.showToast({ title: M.NICKNAME_REQUIRED, icon: 'none' })
        return
      }

      this.setData({ submitting: true })

      try {
        let avatarUrl = ''

        if (this.data.avatarTempPath) {
          const uploadRes = await uploadAvatar(this.data.avatarTempPath)
          avatarUrl = uploadRes.url
        }

        await updateUserProfile({
          nickname,
          avatarUrl: avatarUrl || undefined,
        })

        const profile = await getUserProfile()
        const app = getApp()
        app.globalData.userInfo = profile

        wx.showToast({ title: M.PROFILE_SETUP_SUCCESS, icon: 'success' })
        this.triggerEvent('done', { profile })
      } catch (e) {
        wx.showToast({ title: M.PROFILE_SETUP_FAIL, icon: 'none' })
      } finally {
        this.setData({ submitting: false })
      }
    },

    onSkip() {
      this.triggerEvent('done')
    },
  },
})
