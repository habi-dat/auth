import Vue from 'vue'
import Router from 'vue-router'
import Profile from '@/pages/user/Profile'
import EditProfile from '@/pages/user/EditProfile'
import ChangePassword from '@/pages/user/ChangePassword'
import ResetPassword from '@/pages/user/ResetPassword'
import Invites from '@/pages/user/Invites'
import SendInvite from '@/pages/user/SendInvite'
import AcceptInvite from '@/pages/user/AcceptInvite'
import UserList from '@/pages/user/UserList'
import CreateUser from '@/pages/user/CreateUser'
import UpdateUser from '@/pages/user/UpdateUser'
import GroupList from '@/pages/group/GroupList'
import CreateGroup from '@/pages/group/CreateGroup'
import UpdateGroup from '@/pages/group/UpdateGroup'
import CategoryList from '@/pages/category/CategoryList'
import CreateCategory from '@/pages/category/CreateCategory'
import UpdateCategory from '@/pages/category/UpdateCategory'
import AppList from '@/pages/app/AppList'
import CreateApp from '@/pages/app/CreateApp'
import UpdateApp from '@/pages/app/UpdateApp'
import UpdateSettings from '@/pages/settings/UpdateSettings'
import TemplateEditor from '@/pages/settings/TemplateEditor'
import Login from '@/pages/Login'
import ErrorPage from '@/pages/ErrorPage'
import axios from 'axios'

Vue.use(Router)

var router = new Router({
  routes: [
    {
      path: '/',
      name: 'Profile',
      component: Profile
    },
    {
      path: '/profile/edit',
      name: 'EditProfile',
      component: EditProfile
    },
    {
      path: '/user/password',
      name: 'ChangePassword',
      component: ChangePassword
    },
    {
      path: '/user/setpassword',
      name: 'SetPassword',
      component: ChangePassword
    },
    {
      path: '/user/password/reset',
      name: 'ResetPassword',
      component: ResetPassword
    },
    {
      path: '/invites',
      name: 'Invites',
      component: Invites
    },
    {
      path: '/invite',
      name: 'SendInvite',
      component: SendInvite
    },
    {
      path: '/user/list',
      name: 'UserList',
      component: UserList
    },
    {
      path: '/user/create',
      name: 'CreateUser',
      component: CreateUser
    },
    {
      path: '/user/acceptinvite',
      name: 'AcceptInvite',
      component: AcceptInvite
    },
    {
      path: '/user/update',
      name: 'UpdateUser',
      component: UpdateUser
    },
    {
      path: '/group/list',
      name: 'GroupList',
      component: GroupList
    },
    {
      path: '/group/create',
      name: 'CreateGroup',
      component: CreateGroup
    },
    {
      path: '/group/update',
      name: 'UpdateGroup',
      component: UpdateGroup
    },
    {
      path: '/category/list',
      name: 'CategoryList',
      component: CategoryList
    },
    {
      path: '/category/create',
      name: 'CreateCategory',
      component: CreateCategory
    },
    {
      path: '/category/update',
      name: 'UpdateCategory',
      component: UpdateCategory
    },
    {
      path: '/app/list',
      name: 'AppList',
      component: AppList
    },
    {
      path: '/app/create',
      name: 'CreateApp',
      component: CreateApp
    },
    {
      path: '/app/update',
      name: 'UpdateApp',
      component: UpdateApp
    },
    {
      path: '/settings',
      name: 'UpdateSettings',
      component: UpdateSettings
    },
    {
      path: '/templates',
      name: 'TemplateEditor',
      component: TemplateEditor
    },
    {
      path: '/login',
      name: 'Login',
      component: Login
    },
    {
      path: '/error',
      name: 'ErrorPage',
      component: ErrorPage
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  // check if server is online
  var noLoginPages = ['ErrorPage', 'SetPassword', 'AcceptInvite'];
  var noReturnToPages = ['ErrorPage', 'SetPassword', 'ResetPassword', 'AcceptInvite', 'Login'];
  try {
    if (!noLoginPages.includes(to.name)) {
      if (to.name === 'Login' && !to.query.returnTo && !noReturnToPages.includes(from.name) && from.path !== '/logout') {
        next({name: 'Login', query: {returnTo: from.path, returnToDn: from.query.dn}})
      } else {
        if (to.name !== 'Login' && from.name !== 'Login') {
          axios.get('/api/config')
            .then(response => {
              if (!response.data.config.authenticated) {
                next({name: 'Login'})
              } else {
                next();
              }
            })
        } else {
          next();
        }
      }
    } else {
      next()
    }
  } catch(e) {
    next({name: 'ErrorPage'});
  }

})

export default router;
