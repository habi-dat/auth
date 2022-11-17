<template>
  <v-card outlined class="d-inline-block" width="800" elevation=5>
    <Toolbar :title="$store.state.user.cn" icon="person">
      <template #right>
        <ToolbarButton
          icon="edit"
          tooltip="Profil bearbeiten"
          color="info"
          to="/profile/edit"
        />
        <ToolbarButton
          icon="lock"
          tooltip="Passwort ändern"
          color="info"
          to="/user/password"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text>
      <v-list>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>face</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ $store.state.user.cn  }}</v-list-item-title><v-list-item-subtitle>Anzeigename</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>person</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ $store.state.user.uid  }}</v-list-item-title><v-list-item-subtitle>User ID</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>night_shelter</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ $store.state.user.title  }}</v-list-item-title><v-list-item-subtitle>Zugehörigkeit</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>home</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ $store.state.user.l  }}</v-list-item-title><v-list-item-subtitle>Ort</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>email</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ $store.state.user.mail  }}</v-list-item-title><v-list-item-subtitle>E-Mail Adresse</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>language</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ $store.state.user.preferredLanguage || "de" }}</v-list-item-title><v-list-item-subtitle>Sprache</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>upload</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ $store.state.user.description  }}</v-list-item-title><v-list-item-subtitle>Speicherplatz</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card-text>
    <v-divider />
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '../../router'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  name: 'Profile',
  components: { ToolbarButton, Toolbar },
  data () {
    return {}
  },
}
</script>
