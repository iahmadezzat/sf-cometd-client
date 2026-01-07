/**
 * Created by Ahmad Ezzat on 2026-01-07.
 */

public with sharing class CometDController {

    @AuraEnabled(Cacheable=true)
    public static Map<String, String> getContext() {

        JSONGenerator gen = JSON.createGenerator(false);
        gen.writeObject(new User(Id = UserInfo.getUserId()));
        Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(gen.getAsString());
        Map<String, Object> resultAttributes = (Map<String, Object>) result.get('attributes');
        String resultAttributesURL = (String) resultAttributes.get('url');
        String apiVersion = resultAttributesURL.substringAfter('/services/data/v').substringBefore('/');

        return new Map<String, String>{
                'sessionId' => UserInfo.getSessionId(),
                'apiVersion' => apiVersion
        };
    }
}