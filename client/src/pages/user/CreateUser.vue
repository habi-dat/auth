<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Account erstellen" back >
      <template #right>
        <ToolbarButton
          icon="save"
          tooltip="Speichern"
          color="success"
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
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      this.user.member = this.user.memberGroups.map(g => g.dn);
      this.user.owner = this.user.ownerGroups.map(g => g.dn);
      axios.post('/api/user/create', this.user)
        .then(response => {
          this.$snackbar.success('Account erstellt')
          router.push('/user/list')
        })
        .catch(errors => {
          //this.$snackbar.error('Profil konnte nicht gespeichert werden: ' + errors)
          console.log('error at creating user: ', errors)
        })
    }
  },
  created() {
    this.user = { preferredLanguage: 'de', description: '10 GB', member: [], owner: [], memberGroups: [], ownerGroups: []}
  }
}
</script>