<template>

  <v-card outlined class="d-inline-block" min-width="800">
    <Toolbar title="Profil bearbeiten" back>
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
    <v-card-text>
        <UserForm :user="user" @valid="valid => { this.valid = valid}" action="editProfile" />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '../../router'
import UserForm from '@/components/user/UserForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { UserForm, Toolbar, ToolbarButton },
  data() {
    return {
      user: {},
      valid: true
    }
  },
  methods: {
    save: function () {
      axios.post('/api/user/profile', this.user)
        .then(response => {
          this.$store.state.config.authenticated = true
          this.$store.state.user = response.data.user
          this.$snackbar.success('Profil gespeichert')
          router.push('/profile')
        })
        .catch(errors => {
          //this.$snackbar.error('Profil konnte nicht gespeichert werden: ' + errors)
          console.log('error at saving profile: ', errors)
        })
    }
  },
  created() {
    this.user = { ...this.$store.state.user }
  }
}
</script>