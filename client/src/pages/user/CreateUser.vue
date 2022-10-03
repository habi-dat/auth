<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Account erstellen" back >
      <template #right>
        <ToolbarButton
          icon="save"
          tooltip="Speichern"
          color="success"
          :loading="loading"
          @click="save"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
      <UserForm
        :user="user"
        @valid="onValid"
        action="createUser"
        showGroups
        showPassword
        allowUid
        allowMail
        allowDescription
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import UserForm from '@/components/user/UserForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { UserForm, Toolbar, ToolbarButton },
  data() {
    return {
      user: {},
      valid: true,
      loading: false,
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      this.loading = true;
      this.user.member = this.user.memberGroups.map(g => g.dn);
      this.user.owner = this.user.ownerGroups.map(g => g.dn);
      axios.post('/api/user/create', this.user)
        .then(response => {
          this.loading = false;
          this.$snackbar.success('Account erstellt')
          if (this.$route.query.token) {
            router.push('/login')
          } else {
            router.push('/user/list')
          }
        })
        .catch(errors => {
          this.loading = false;
        })
    }
  },
  created() {
    this.user = { preferredLanguage: 'de', description: '1 GB', member: [], owner: [], memberGroups: [], ownerGroups: []}
  }
}
</script>